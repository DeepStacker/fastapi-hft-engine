"""
TLS/SSL Configuration Helpers

Utilities for configuring TLS/SSL in production.
"""
import ssl
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)


def create_ssl_context(
    certfile: Optional[str] = None,
    keyfile: Optional[str] = None,
    ca_certs: Optional[str] = None,
    verify_mode: ssl.VerifyMode = ssl.CERT_REQUIRED
) -> ssl.SSLContext:
    """
    Create SSL context for secure connections
    
    Args:
        certfile: Path to certificate file
        keyfile: Path to private key file
        ca_certs: Path to CA certificate bundle
        verify_mode: Certificate verification mode
        
    Returns:
        Configured SSLContext
    """
    # Create context with secure defaults
    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    
    # Load certificates if provided
    if certfile and keyfile:
        context.load_cert_chain(certfile, keyfile)
        logger.info("SSL certificates loaded", certfile=certfile)
        
    # Load CA certificates
    if ca_certs:
        context.load_verify_locations(ca_certs)
        
    # Set verification mode
    context.verify_mode = verify_mode
    
    # Enforce strong ciphers (TLS 1.2+)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS')
    
    return context


def get_redis_ssl_config(
    ssl_cert: Optional[str] = None,
    ssl_key: Optional[str] = None,
    ssl_ca: Optional[str] = None
) -> dict:
    """
    Get Redis SSL configuration
    
    Args:
        ssl_cert: Path to client certificate
        ssl_key: Path to client key
        ssl_ca: Path to CA certificate
        
    Returns:
        Redis connection kwargs with SSL
    """
    if not (ssl_cert or ssl_ca):
        return {}
        
    return {
        "ssl": True,
        "ssl_certfile": ssl_cert,
        "ssl_keyfile": ssl_key,
        "ssl_ca_certs": ssl_ca,
        "ssl_cert_reqs": "required"
    }


def get_postgres_ssl_config(
    ssl_mode: str = "require",
    ssl_cert: Optional[str] = None,
    ssl_key: Optional[str] = None,
    ssl_rootcert: Optional[str] = None
) -> dict:
    """
    Get PostgreSQL SSL configuration
    
    Args:
        ssl_mode: SSL mode (disable, allow, prefer, require, verify-ca, verify-full)
        ssl_cert: Path to client certificate
        ssl_key: Path to client key
        ssl_rootcert: Path to root certificate
        
    Returns:
        PostgreSQL connection kwargs with SSL
    """
    config = {"sslmode": ssl_mode}
    
    if ssl_cert:
        config["sslcert"] = ssl_cert
    if ssl_key:
        config["sslkey"] = ssl_key
    if ssl_rootcert:
        config["sslrootcert"] = ssl_rootcert
        
    return config


def validate_ssl_config() -> bool:
    """
    Validate SSL configuration
    
    Returns:
        True if SSL can be configured
    """
    try:
        # Try creating SSL context
        context = create_ssl_context()
        logger.info("SSL configuration validated")
        return True
    except Exception as e:
        logger.error(f"SSL configuration invalid: {e}")
        return False


# Production SSL recommendations
SSL_RECOMMENDATIONS = """
Production SSL/TLS Configuration Checklist:

1. Generate certificates:
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

2. Set environment variables:
   export SSL_CERT_FILE=/path/to/cert.pem
   export SSL_KEY_FILE=/path/to/key.pem
   export SSL_CA_FILE=/path/to/ca-bundle.crt

3. Configure services:
   - Redis: Use redis+ssl:// URL scheme
   - PostgreSQL: Set sslmode=require or verify-full
   - FastAPI: Use uvicorn with --ssl-keyfile and --ssl-certfile

4. Enable HSTS headers:
   Add middleware to set Strict-Transport-Security

5. Test configuration:
   curl -v https://your-domain.com
   
6. Auto-renew with Let's Encrypt (recommended):
   certbot certonly --standalone -d yourdomain.com
"""
