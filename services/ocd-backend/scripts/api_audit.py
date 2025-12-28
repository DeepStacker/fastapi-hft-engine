#!/usr/bin/env python3
"""
Backend API Comprehensive Audit Script

This script tests all backend API endpoints, captures responses,
and stores them in structured JSON files for analysis.

Usage:
    python api_audit.py --token YOUR_AUTH_TOKEN [--base-url http://localhost:8000]

Output:
    - api_audit_responses.json: All captured responses
    - api_audit_report.json: Summary and statistics
"""

import os
import sys
import json
import argparse
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict

import httpx


# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class EndpointConfig:
    """Configuration for a single API endpoint test."""
    method: str
    path: str
    name: str
    auth_required: bool = True
    admin_required: bool = False
    params: Optional[Dict] = None
    body: Optional[Dict] = None
    description: str = ""
    category: str = "general"


# Test parameters for dynamic endpoints
TEST_SYMBOL = "NIFTY"
TEST_EXPIRY = "1734595199"  # Example expiry timestamp
TEST_STRIKE = 24500.0
TEST_DATE = "2024-12-16"
TEST_TIME = "10:30"


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoint Definitions
# ═══════════════════════════════════════════════════════════════════════════════

ENDPOINTS: List[EndpointConfig] = [
    # ─────────────────────────────────────────────────────────────────────────────
    # Health (No Auth)
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/health", "Health Check", auth_required=False, category="health"),
    EndpointConfig("GET", "/", "Root", auth_required=False, category="health"),
    EndpointConfig("GET", "/metrics", "Prometheus Metrics", auth_required=False, category="health"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Auth Endpoints
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/auth/profile", "Auth - Get Profile", category="auth"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Profile Endpoints
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/profile/me", "Profile - Get My Profile", category="profile"),
    EndpointConfig("GET", "/profile/me/stats", "Profile - Get My Stats", category="profile"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Options Endpoints
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", f"/options/expiry/{TEST_SYMBOL}", "Options - Get Expiry Dates", category="options"),
    EndpointConfig("GET", f"/options/chain/{TEST_SYMBOL}/{TEST_EXPIRY}", "Options - Get Chain", 
                   params={"include_greeks": True, "include_reversal": True}, category="options"),
    EndpointConfig("GET", "/options/live", "Options - Live Data", 
                   params={"sid": TEST_SYMBOL, "exp_sid": TEST_EXPIRY}, category="options"),
    EndpointConfig("POST", "/options/percentage", "Options - Percentage Analysis",
                   body={"symbol": TEST_SYMBOL, "expiry": TEST_EXPIRY, "strike": TEST_STRIKE, "option_type": "CE"},
                   category="options"),
    EndpointConfig("POST", "/options/iv", "Options - IV Analysis",
                   body={"symbol": TEST_SYMBOL, "expiry": TEST_EXPIRY, "strike": TEST_STRIKE, "option_type": "CE"},
                   category="options"),
    EndpointConfig("POST", "/options/delta", "Options - Delta Analysis",
                   body={"symbol": TEST_SYMBOL, "expiry": TEST_EXPIRY, "strike": TEST_STRIKE},
                   category="options"),
    EndpointConfig("POST", "/options/future", "Options - Future Price",
                   body={"symbol": TEST_SYMBOL, "expiry": TEST_EXPIRY},
                   category="options"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Analytics - Timeseries
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", f"/analytics/timeseries/{TEST_SYMBOL}/{int(TEST_STRIKE)}", "Analytics - Strike Timeseries",
                   params={"option_type": "CE", "field": "oi", "interval": "5m", "limit": 50},
                   category="analytics-timeseries"),
    EndpointConfig("GET", f"/analytics/timeseries/spot/{TEST_SYMBOL}", "Analytics - Spot Timeseries",
                   params={"interval": "5m", "limit": 100}, category="analytics-timeseries"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Analytics - Analysis
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", f"/analytics/strike/{TEST_SYMBOL}/{int(TEST_STRIKE)}", "Analytics - Strike Analysis",
                   params={"expiry": TEST_EXPIRY}, category="analytics-analysis"),
    EndpointConfig("GET", f"/analytics/reversal/{TEST_SYMBOL}/{int(TEST_STRIKE)}", "Analytics - Reversal Levels",
                   params={"expiry": TEST_EXPIRY}, category="analytics-analysis"),
    EndpointConfig("GET", f"/analytics/futures/{TEST_SYMBOL}", "Analytics - Futures Summary",
                   category="analytics-analysis"),
    EndpointConfig("GET", f"/analytics/oi-distribution/{TEST_SYMBOL}/{TEST_EXPIRY}", "Analytics - OI Distribution",
                   params={"top_n": 20}, category="analytics-analysis"),
    EndpointConfig("GET", f"/analytics/maxpain/{TEST_SYMBOL}/{TEST_EXPIRY}", "Analytics - Max Pain",
                   category="analytics-analysis"),
    EndpointConfig("GET", f"/analytics/iv-skew/{TEST_SYMBOL}/{TEST_EXPIRY}", "Analytics - IV Skew",
                   category="analytics-analysis"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Analytics - Aggregate
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", f"/analytics/aggregate/coi/{TEST_SYMBOL}/{TEST_EXPIRY}", "Analytics - Aggregate COI",
                   params={"top_n": 30}, category="analytics-aggregate"),
    EndpointConfig("GET", f"/analytics/aggregate/oi/{TEST_SYMBOL}/{TEST_EXPIRY}", "Analytics - Aggregate OI",
                   params={"top_n": 30}, category="analytics-aggregate"),
    EndpointConfig("GET", f"/analytics/aggregate/pcr/{TEST_SYMBOL}/{TEST_EXPIRY}", "Analytics - Aggregate PCR",
                   category="analytics-aggregate"),
    EndpointConfig("GET", f"/analytics/aggregate/percentage/{TEST_SYMBOL}/{TEST_EXPIRY}", "Analytics - Aggregate Percentage",
                   category="analytics-aggregate"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Historical
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", f"/historical/dates/{TEST_SYMBOL}", "Historical - Available Dates",
                   category="historical"),
    EndpointConfig("GET", f"/historical/times/{TEST_SYMBOL}/{TEST_DATE}", "Historical - Available Times",
                   category="historical"),
    EndpointConfig("GET", "/historical/snapshot", "Historical - Snapshot",
                   params={"symbol": TEST_SYMBOL, "expiry": TEST_EXPIRY, "date": TEST_DATE, "time": TEST_TIME},
                   category="historical"),
    EndpointConfig("GET", "/historical/replay", "Historical - Replay Data",
                   params={"symbol": TEST_SYMBOL, "expiry": TEST_EXPIRY, "date": TEST_DATE, 
                           "start_time": "09:15", "end_time": "15:30", "interval": 5},
                   category="historical"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Screeners
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", f"/screeners/scalp/{TEST_SYMBOL}/{TEST_EXPIRY}", "Screeners - Scalp Signals",
                   params={"min_oi_change_pct": 5.0, "min_volume": 1000}, category="screeners"),
    EndpointConfig("GET", f"/screeners/positional/{TEST_SYMBOL}/{TEST_EXPIRY}", "Screeners - Positional Signals",
                   params={"min_oi_buildup": 100000}, category="screeners"),
    EndpointConfig("GET", f"/screeners/sr/{TEST_SYMBOL}/{TEST_EXPIRY}", "Screeners - S/R Signals",
                   category="screeners"),
    EndpointConfig("GET", f"/screeners/all/{TEST_SYMBOL}/{TEST_EXPIRY}", "Screeners - All Signals",
                   category="screeners"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Calculators
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("POST", "/calculators/option-price", "Calculators - Option Price",
                   body={"spot": 24500, "strike": 24500, "time_to_expiry": 0.05, 
                         "risk_free_rate": 0.07, "volatility": 0.15, "dividend_yield": 0},
                   category="calculators"),
    EndpointConfig("POST", "/calculators/implied-volatility", "Calculators - IV",
                   body={"option_price": 200, "spot": 24500, "strike": 24500, 
                         "time_to_expiry": 0.05, "risk_free_rate": 0.07, "option_type": "CE"},
                   category="calculators"),
    EndpointConfig("POST", "/calculators/sip", "Calculators - SIP",
                   body={"monthly_investment": 10000, "annual_return": 12, "years": 10},
                   category="calculators"),
    EndpointConfig("POST", "/calculators/lumpsum", "Calculators - Lumpsum",
                   body={"principal": 100000, "annual_return": 12, "years": 10},
                   category="calculators"),
    EndpointConfig("POST", "/calculators/swp", "Calculators - SWP",
                   body={"initial_investment": 1000000, "monthly_withdrawal": 10000, 
                         "annual_return": 8, "years": 20},
                   category="calculators"),
    EndpointConfig("POST", "/calculators/margin", "Calculators - Margin",
                   body={"spot": 24500, "strike": 24500, "option_type": "CE", 
                         "premium": 200, "lot_size": 50, "is_buy": True},
                   category="calculators"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Charts
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/charts/data", "Charts - OHLCV Data",
                   params={"symbol": TEST_SYMBOL, "interval": "15", "days": 30},
                   category="charts"),
    EndpointConfig("GET", "/charts/symbols", "Charts - Available Symbols",
                   auth_required=False, category="charts"),
    EndpointConfig("GET", "/charts/intervals", "Charts - Available Intervals",
                   auth_required=False, category="charts"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Notifications
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/notifications", "Notifications - Get List",
                   params={"limit": 20, "unread_only": False}, category="notifications"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # SSE Fallback (Skip streaming endpoints for audit)
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", f"/sse/poll/{TEST_SYMBOL}/{TEST_EXPIRY}", "SSE - Poll Data",
                   auth_required=False, category="sse"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Admin Endpoints (Admin Only) - Routes are /admin/config, /admin/settings/runtime, /admin/features
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/admin/config", "Admin - List Configs", admin_required=True, category="admin"),
    EndpointConfig("GET", "/admin/instruments", "Admin - List Instruments",
                   params={"active_only": True}, admin_required=True, category="admin"),
    EndpointConfig("GET", "/admin/settings/runtime", "Admin - Runtime Settings", 
                   admin_required=True, category="admin"),
    EndpointConfig("GET", "/admin/features", "Admin - Feature Flags",
                   admin_required=True, category="admin"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Monitoring (Admin Only) - Routes have /admin/monitoring prefix
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/admin/monitoring/system", "Monitoring - System Metrics",
                   admin_required=True, category="monitoring"),
    EndpointConfig("GET", "/admin/monitoring/websockets", "Monitoring - WebSocket Stats",
                   admin_required=True, category="monitoring"),
    EndpointConfig("GET", "/admin/monitoring/database", "Monitoring - Database Stats",
                   admin_required=True, category="monitoring"),
    EndpointConfig("GET", "/admin/monitoring/redis", "Monitoring - Redis Stats",
                   admin_required=True, category="monitoring"),
    EndpointConfig("GET", "/admin/monitoring/logs", "Monitoring - Application Logs",
                   params={"limit": 100}, admin_required=True, category="monitoring"),
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Users (Admin Only)
    # ─────────────────────────────────────────────────────────────────────────────
    EndpointConfig("GET", "/users", "Users - List Users",
                   params={"page": 1, "page_size": 20}, admin_required=True, category="users"),
]


# ═══════════════════════════════════════════════════════════════════════════════
# API Client
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class EndpointResult:
    """Result of testing a single endpoint."""
    name: str
    path: str
    method: str
    category: str
    status_code: int
    success: bool
    response_time_ms: float
    response_body: Any
    error_message: Optional[str] = None
    headers: Optional[Dict] = None
    auth_required: bool = True
    admin_required: bool = False


class APIAuditor:
    """Audits all backend API endpoints."""
    
    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url.rstrip("/")
        self.auth_token = auth_token
        self.results: List[EndpointResult] = []
        
    def _get_headers(self, auth_required: bool) -> Dict[str, str]:
        """Get headers for the request."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if auth_required and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers
    
    async def test_endpoint(self, config: EndpointConfig) -> EndpointResult:
        """Test a single endpoint and return the result."""
        url = f"{self.base_url}/api/v1{config.path}"
        headers = self._get_headers(config.auth_required or config.admin_required)
        
        start_time = datetime.now()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if config.method == "GET":
                    response = await client.get(url, headers=headers, params=config.params)
                elif config.method == "POST":
                    response = await client.post(url, headers=headers, json=config.body, params=config.params)
                elif config.method == "PUT":
                    response = await client.put(url, headers=headers, json=config.body)
                elif config.method == "DELETE":
                    response = await client.delete(url, headers=headers)
                else:
                    raise ValueError(f"Unsupported method: {config.method}")
            
            response_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Try to parse response as JSON
            try:
                response_body = response.json()
            except:
                response_body = response.text[:1000] if response.text else None
            
            success = 200 <= response.status_code < 300
            error_message = None
            if not success:
                if isinstance(response_body, dict):
                    error_message = response_body.get("detail") or response_body.get("message")
                else:
                    error_message = str(response_body)[:200]
            
            return EndpointResult(
                name=config.name,
                path=config.path,
                method=config.method,
                category=config.category,
                status_code=response.status_code,
                success=success,
                response_time_ms=round(response_time, 2),
                response_body=response_body,
                error_message=error_message,
                headers=dict(response.headers),
                auth_required=config.auth_required,
                admin_required=config.admin_required,
            )
            
        except httpx.TimeoutException:
            return EndpointResult(
                name=config.name,
                path=config.path,
                method=config.method,
                category=config.category,
                status_code=0,
                success=False,
                response_time_ms=30000.0,
                response_body=None,
                error_message="Request timed out",
                auth_required=config.auth_required,
                admin_required=config.admin_required,
            )
        except Exception as e:
            return EndpointResult(
                name=config.name,
                path=config.path,
                method=config.method,
                category=config.category,
                status_code=0,
                success=False,
                response_time_ms=0,
                response_body=None,
                error_message=str(e),
                auth_required=config.auth_required,
                admin_required=config.admin_required,
            )
    
    async def run_audit(self, endpoints: List[EndpointConfig]) -> List[EndpointResult]:
        """Run audit on all endpoints."""
        print(f"\n{'='*80}")
        print(f"  Backend API Audit - {len(endpoints)} endpoints")
        print(f"  Base URL: {self.base_url}")
        print(f"{'='*80}\n")
        
        for i, config in enumerate(endpoints, 1):
            print(f"[{i:02d}/{len(endpoints)}] Testing: {config.name}...", end=" ", flush=True)
            result = await self.test_endpoint(config)
            self.results.append(result)
            
            status_symbol = "✓" if result.success else "✗"
            print(f"{status_symbol} {result.status_code} ({result.response_time_ms}ms)")
            
            if not result.success and result.error_message:
                print(f"         └── Error: {result.error_message[:100]}")
        
        return self.results
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate audit report summary."""
        total = len(self.results)
        successful = sum(1 for r in self.results if r.success)
        failed = total - successful
        
        # Group by category
        by_category = {}
        for result in self.results:
            cat = result.category
            if cat not in by_category:
                by_category[cat] = {"total": 0, "success": 0, "failed": 0, "endpoints": []}
            by_category[cat]["total"] += 1
            if result.success:
                by_category[cat]["success"] += 1
            else:
                by_category[cat]["failed"] += 1
            by_category[cat]["endpoints"].append({
                "name": result.name,
                "path": result.path,
                "method": result.method,
                "status": result.status_code,
                "success": result.success,
                "response_time_ms": result.response_time_ms,
                "error": result.error_message,
            })
        
        # Find slowest endpoints
        slowest = sorted(
            [r for r in self.results if r.success],
            key=lambda x: x.response_time_ms,
            reverse=True
        )[:10]
        
        # Failed endpoints
        failed_endpoints = [r for r in self.results if not r.success]
        
        return {
            "audit_timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "summary": {
                "total_endpoints": total,
                "successful": successful,
                "failed": failed,
                "success_rate": round(successful / total * 100, 2) if total > 0 else 0,
            },
            "by_category": by_category,
            "slowest_endpoints": [
                {"name": r.name, "path": r.path, "time_ms": r.response_time_ms}
                for r in slowest
            ],
            "failed_endpoints": [
                {"name": r.name, "path": r.path, "status": r.status_code, "error": r.error_message}
                for r in failed_endpoints
            ],
        }
    
    def save_results(self, output_dir: str):
        """Save results to JSON files."""
        os.makedirs(output_dir, exist_ok=True)
        
        # Save detailed responses
        responses_file = os.path.join(output_dir, "api_audit_responses.json")
        responses_data = []
        for r in self.results:
            data = asdict(r)
            # Preserve response body but limit size
            if isinstance(data["response_body"], dict):
                response_str = json.dumps(data["response_body"])
                if len(response_str) > 50000:
                    data["response_body"] = {"_truncated": True, "_size": len(response_str)}
            responses_data.append(data)
        
        with open(responses_file, "w") as f:
            json.dump(responses_data, f, indent=2, default=str)
        print(f"\n✓ Saved responses to: {responses_file}")
        
        # Save report
        report_file = os.path.join(output_dir, "api_audit_report.json")
        report = self.generate_report()
        with open(report_file, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"✓ Saved report to: {report_file}")
        
        return responses_file, report_file


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(description="Backend API Comprehensive Audit")
    parser.add_argument("--token", required=True, help="Firebase auth token (Bearer token)")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--output-dir", default="./audit_results", help="Output directory")
    parser.add_argument("--skip-admin", action="store_true", help="Skip admin-only endpoints")
    args = parser.parse_args()
    
    # Filter endpoints if needed
    endpoints = ENDPOINTS
    if args.skip_admin:
        endpoints = [e for e in endpoints if not e.admin_required]
        print(f"Skipping admin endpoints. Testing {len(endpoints)} endpoints.")
    
    # Run audit
    auditor = APIAuditor(args.base_url, args.token)
    await auditor.run_audit(endpoints)
    
    # Save results
    auditor.save_results(args.output_dir)
    
    # Print summary
    report = auditor.generate_report()
    print(f"\n{'='*80}")
    print(f"  AUDIT SUMMARY")
    print(f"{'='*80}")
    print(f"  Total Endpoints:  {report['summary']['total_endpoints']}")
    print(f"  Successful:       {report['summary']['successful']} ✓")
    print(f"  Failed:           {report['summary']['failed']} ✗")
    print(f"  Success Rate:     {report['summary']['success_rate']}%")
    print(f"{'='*80}\n")
    
    if report['failed_endpoints']:
        print("Failed Endpoints:")
        for ep in report['failed_endpoints']:
            print(f"  - {ep['name']}: {ep['status']} - {ep['error']}")
    
    return 0 if report['summary']['failed'] == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
