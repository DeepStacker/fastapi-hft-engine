"""
Pagination Utilities

Cursor-based pagination for large datasets with efficient queries.
"""

from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel
import base64
import json

T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response"""
    items: List[T]
    total: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None


class CursorPaginator:
    """
    Cursor-based pagination for efficient large dataset traversal.
    
    Uses cursor instead of offset to avoid N+1 query performance issues.
    """
    
    @staticmethod
    def encode_cursor(value: dict) -> str:
        """Encode cursor to base64"""
        json_str = json.dumps(value, default=str)
        return base64.b64encode(json_str.encode()).decode()
    
    @staticmethod
    def decode_cursor(cursor: str) -> dict:
        """Decode cursor from base64"""
        try:
            json_str = base64.b64decode(cursor.encode()).decode()
            return json.loads(json_str)
        except Exception:
            return {}
    
    @staticmethod
    def paginate(
        items: List[T],
        page: int,
        page_size: int,
        total: int
    ) -> PaginatedResponse[T]:
        """
        Create paginated response.
        
        Args:
            items: List of items for current page
            page: Current page number (1-indexed)
            page_size: Items per page
            total: Total number of items
            
        Returns:
            PaginatedResponse with pagination metadata
        """
        total_pages = (total + page_size - 1) // page_size
        
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_next=page < total_pages,
            has_prev=page > 1
        )
    
    @staticmethod
    def create_cursor_response(
        items: List[T],
        cursor_field: str,
        page_size: int,
        total: Optional[int] = None
    ) -> dict:
        """
        Create cursor-based paginated response.
        
        Args:
            items: List of items (should fetch page_size + 1)
            cursor_field: Field to use for cursor
            page_size: Requested page size
            total: Optional total count
            
        Returns:
            Response with next_cursor
        """
        has_next = len(items) > page_size
        result_items = items[:page_size]
        
        next_cursor = None
        if has_next and result_items:
            last_item = result_items[-1]
            if isinstance(last_item, dict):
                cursor_value = last_item.get(cursor_field)
            else:
                cursor_value = getattr(last_item, cursor_field, None)
            
            if cursor_value:
                next_cursor = CursorPaginator.encode_cursor({cursor_field: cursor_value})
        
        return {
            "items": result_items,
            "page_size": len(result_items),
            "has_next": has_next,
            "next_cursor": next_cursor,
            "total": total
        }


# SQL helpers for cursor pagination
def apply_cursor_to_query(query, cursor_data: dict, model, ascending: bool = True):
    """
    Apply cursor to SQLAlchemy query.
    
    Args:
        query: SQLAlchemy query
        cursor_data: Decoded cursor data
        model: SQLAlchemy model
        ascending: Sort direction
        
    Returns:
        Modified query
    """
    if not cursor_data:
        return query
    
    for field, value in cursor_data.items():
        column = getattr(model, field, None)
        if column is not None:
            if ascending:
                query = query.where(column > value)
            else:
                query = query.where(column < value)
    
    return query
