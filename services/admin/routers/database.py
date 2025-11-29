"""
Database Management Router

Handles database operations, table browsing, and statistics.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any
from sqlalchemy import text, inspect
from services.gateway.auth import get_current_admin_user
from services.admin.models import TableInfo, DatabaseStats
from core.database.db import async_session_factory
from services.admin.services.cache import cache_service
import logging
import pydantic

logger = logging.getLogger("stockify.admin.database")
router = APIRouter(prefix="/database", tags=["database"])
# Force update check


@router.get("/stats", response_model=DatabaseStats)
async def get_database_stats(admin = Depends(get_current_admin_user)):
    """Get database statistics"""
    # Try cache first
    cache_key = "db:stats"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return DatabaseStats(**cached_data)

    async with async_session_factory() as session:
        try:
            # Get total tables
            tables_result = await session.execute(text("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            total_tables = tables_result.scalar()
            
            # Get database size
            size_result = await session.execute(text("""
                SELECT pg_database_size(current_database()) / 1024.0 / 1024.0 as size_mb
            """))
            total_size_mb = float(size_result.scalar())
            
            # Get connection stats
            conn_result = await session.execute(text("""
                SELECT 
                    (SELECT count(*) FROM pg_stat_activity) as active,
                    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max
            """))
            conn_row = conn_result.fetchone()
            active_connections = conn_row[0]
            max_connections = conn_row[1]
            
            # Get cache hit ratio
            cache_result = await session.execute(text("""
                SELECT 
                    sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0) * 100 as hit_ratio
                FROM pg_statio_user_tables
            """))
            cache_hit_ratio = float(cache_result.scalar() or 0)
            
            result = DatabaseStats(
                total_tables=total_tables,
                total_size_mb=total_size_mb,
                active_connections=active_connections,
                max_connections=max_connections,
                cache_hit_ratio=cache_hit_ratio
            )
            
            # Cache result (30s TTL)
            await cache_service.set(cache_key, result.dict(), ttl=30)
            return result
            
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables", response_model=List[TableInfo])
async def list_tables(admin = Depends(get_current_admin_user)):
    """List all database tables with metadata"""
    # Try cache first
    cache_key = "db:tables"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return [TableInfo(**item) for item in cached_data]

    async with async_session_factory() as session:
        try:
            result = await session.execute(text("""
                SELECT 
                    schemaname as schema,
                    relname as name,
                    n_live_tup as row_count,
                    pg_total_relation_size(schemaname||'.'||relname) / 1024.0 / 1024.0 as size_mb
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
            """))
            
            tables = []
            for row in result:
                # Get indexes for this table
                idx_result = await session.execute(text("""
                    SELECT indexname
                    FROM pg_indexes
                    WHERE schemaname = :schema AND tablename = :table
                """), {"schema": row.schema, "table": row.name})
                
                indexes = [idx[0] for idx in idx_result.fetchall()]
                
                tables.append(TableInfo(
                    name=row.name,
                    schema=row.schema,
                    row_count=row.row_count or 0,
                    size_mb=float(row.size_mb or 0),
                    indexes=indexes
                ))
            
            # Cache result (60s TTL)
            await cache_service.set(
                cache_key, 
                [t.dict() for t in tables], 
                ttl=60
            )
            
            return tables
            
        except Exception as e:
            logger.error(f"Failed to list tables: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{table_name}/schema")
async def get_table_schema(
    table_name: str,
    admin = Depends(get_current_admin_user)
):
    """Get schema information for a table"""
    # Try cache first
    cache_key = f"db:schema:{table_name}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return cached_data

    async with async_session_factory() as session:
        try:
            result = await session.execute(text("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :table_name
                ORDER BY ordinal_position
            """), {"table_name": table_name})
            
            columns = []
            for row in result:
                columns.append({
                    "name": row.column_name,
                    "type": row.data_type,
                    "nullable": row.is_nullable == 'YES',
                    "default": row.column_default
                })
            
            if not columns:
                raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
            
            response_data = {"table": table_name, "columns": columns}
            
            # Cache result (1 hour TTL - schema rarely changes)
            await cache_service.set(cache_key, response_data, ttl=3600)
            
            return response_data
            
        except Exception as e:
            logger.error(f"Failed to get table schema: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{table_name}/data")
async def browse_table_data(
    table_name: str,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    admin = Depends(get_current_admin_user)
):
    """Browse table data with pagination (read-only, safe)"""
    # No caching for data browsing - needs to be fresh
    async with async_session_factory() as session:
        try:
            # Validate table exists and get column names
            schema_result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :table_name
                ORDER BY ordinal_position
            """), {"table_name": table_name})
            
            columns = [row.column_name for row in schema_result.fetchall()]
            
            if not columns:
                raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
            
            # Safely query data using parameterized table name validation
            # Note: We validated the table exists, now we can query it
            query = f"SELECT * FROM {table_name} ORDER BY id DESC LIMIT :limit OFFSET :offset"
            data_result = await session.execute(
                text(query),
                {"limit": limit, "offset": offset}
            )
            
            rows = []
            for row in data_result:
                row_dict = {}
                for col, val in zip(columns, row):
                    # Convert datetime and other types to JSON-serializable format
                    if hasattr(val, 'isoformat'):
                        val = val.isoformat()
                    row_dict[col] = val
                rows.append(row_dict)
            
            # Get total count
            count_result = await session.execute(
                text(f"SELECT COUNT(*) FROM {table_name}")
            )
            total = count_result.scalar()
            
            return {
                "table": table_name,
                "columns": columns,
                "data": rows,
                "total": total,
                "limit": limit,
                "offset": offset
            }
            
        except Exception as e:
            logger.error(f"Failed to browse table data: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/queries/slow")
async def get_slow_queries(
    limit: int = Query(default=20, le=100),
    admin = Depends(get_current_admin_user)
):
    """Get slow queries from pg_stat_statements"""
    # Try cache first
    cache_key = f"db:queries:slow:{limit}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return cached_data

    async with async_session_factory() as session:
        try:
            # Check if pg_stat_statements is available
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
                )
            """))
            
            if not result.scalar():
                return {
                    "message": "pg_stat_statements extension not installed",
                    "queries": []
                }
            
            # Get slow queries
            result = await session.execute(text("""
                SELECT 
                    query,
                    calls,
                    mean_exec_time,
                    total_exec_time
                FROM pg_stat_statements
                WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
                ORDER BY mean_exec_time DESC
                LIMIT :limit
            """), {"limit": limit})
            
            queries = []
            for row in result:
                queries.append({
                    "query": row.query[:200],  # Truncate long queries
                    "calls": row.calls,
                    "mean_time_ms": float(row.mean_exec_time),
                    "total_time_ms": float(row.total_exec_time)
                })
            
            response_data = {"queries": queries}
            
            # Cache result (60s TTL)
            await cache_service.set(cache_key, response_data, ttl=60)
            
            return response_data
            
        except Exception as e:
            logger.error(f"Failed to get slow queries: {e}")
            return {"message": str(e), "queries": []}
            return {"queries": queries}
            
        except Exception as e:
            logger.error(f"Failed to get slow queries: {e}")
            return {"message": str(e), "queries": []}


class SQLQueryRequest(pydantic.BaseModel):
    query: str
    read_only: bool = True

@router.post("/query")
async def execute_query(
    request: SQLQueryRequest,
    admin = Depends(get_current_admin_user)
):
    """
    Execute raw SQL query (Admin only)
    
    WARNING: This is a powerful endpoint. Use with caution.
    """
    # Basic safety checks
    query_lower = request.query.strip().lower()
    
    if request.read_only:
        forbidden_keywords = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'create', 'grant', 'revoke']
        if any(keyword in query_lower for keyword in forbidden_keywords):
            raise HTTPException(
                status_code=400, 
                detail="Write operations are not allowed in read-only mode. Uncheck 'Read Only' to proceed (Caution!)."
            )
    
    async with async_session_factory() as session:
        try:
            # Execute query
            result = await session.execute(text(request.query))
            
            # If it's a SELECT query, fetch results
            if result.returns_rows:
                rows = result.fetchall()
                keys = result.keys()
                
                data = []
                for row in rows:
                    row_dict = {}
                    for col, val in zip(keys, row):
                        # Handle serialization
                        if hasattr(val, 'isoformat'):
                            val = val.isoformat()
                        row_dict[col] = val
                    data.append(row_dict)
                    
                return {
                    "columns": list(keys),
                    "data": data,
                    "count": len(data)
                }
            else:
                # For non-SELECT queries (UPDATE, DELETE, etc.)
                await session.commit()
                return {
                    "message": "Query executed successfully",
                    "rows_affected": result.rowcount
                }
                
        except Exception as e:
            await session.rollback()
            logger.error(f"Query execution failed: {e}")
            raise HTTPException(status_code=400, detail=str(e))
