from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

