/**
 * Shared TypeScript Interfaces for Admin Frontend
 * 
 * Use these instead of `any` types for better type safety.
 */

// ============================================================================
// Authentication
// ============================================================================

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

export interface User {
    username: string;
    role: 'admin' | 'user';
    created_at: string;
}

// ============================================================================
// Services
// ============================================================================

export interface Service {
    name: string;
    status: 'running' | 'stopped' | 'error' | 'unknown';
    container_id?: string;
    cpu_percent?: number;
    memory_mb?: number;
    uptime?: number;
    restart_count: number;
    last_check: string;
}

export interface ServiceListResponse {
    success: boolean;
    services: Service[];
}

// ============================================================================
// Configuration
// ============================================================================

export interface ConfigItem {
    key: string;
    value: string | number | boolean;
    category: string;
    description?: string;
    is_secret: boolean;
    created_at: string;
    updated_at: string;
}

export interface ConfigListResponse {
    success: boolean;
    configs: ConfigItem[];
}

export interface ConfigUpdateRequest {
    value: string | number | boolean;
}

// ============================================================================
// Instruments
// ============================================================================

export interface Instrument {
    id: number;
    symbol: string;
    symbol_id: number;
    exchange: string;
    segment: string;
    instrument_type: string;
    lot_size: number;
    tick_size: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface InstrumentListResponse {
    success: boolean;
    total: number;
    instruments: Instrument[];
}

export interface InstrumentCreateRequest {
    symbol: string;
    symbol_id: number;
    exchange: string;
    segment: string;
    instrument_type: string;
    lot_size: number;
    tick_size: number;
    is_active?: boolean;
}

// ============================================================================
// Traders
// ============================================================================

export interface Trader {
    id: string;
    name: string;
    email: string;
    broker: string;
    api_key?: string;
    is_active: boolean;
    created_at: string;
}

export interface TraderListResponse {
    success: boolean;
    traders: Trader[];
}

export interface TraderCreateRequest {
    name: string;
    email: string;
    broker: string;
    api_key?: string;
}

// ============================================================================
// Metrics
// ============================================================================

export interface MetricSnapshot {
    time?: string;
    timestamp?: number;
    cpu?: number;
    cpu_percent?: number;
    memory?: number;
    memory_mb?: number;
    active_connections?: number;
    requests_per_second?: number;
}

export interface SystemStats {
    total_services: number;
    services_healthy: number;
    services_unhealthy: number;
    total_instruments: number;
    active_instruments: number;
    uptime_seconds: number;
    cpu_percent?: number;
    memory_percent?: number;
    active_connections?: number;
    cache_hit_rate?: number;
}

export interface DashboardStats {
    system: SystemStats;
    history: MetricSnapshot[];
}

// ============================================================================
// Audit Logs
// ============================================================================

export interface AuditLog {
    id: string;
    action: string;
    user: string;
    resource: string;
    details: Record<string, unknown>;
    ip_address: string;
    timestamp: string;
}

export interface AuditLogListResponse {
    success: boolean;
    total: number;
    logs: AuditLog[];
}

// ============================================================================
// API Response Wrapper
// ============================================================================

export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    success: boolean;
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    data: T[];
    has_next: boolean;
    has_previous: boolean;
}
