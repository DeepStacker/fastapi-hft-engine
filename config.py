import os
from typing import List

# Database: use MySQL with native password authentication
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+aiomysql://root:root@mysql:3306/test_db_optionchain"
)

# REDIS_URLS: str = "redis://localhost:6379"
REDIS_URLS: str = "redis://redis:6379"

API_INSTR_URL = "https://api.example.com/optionchain"
INSTRUMENTS = [
    13, 25, 27, 442, 38, 51, 69, 294, 25, 15083, 157, 236, 5900, 16669, 317, 16675, 383,
    526, 10604, 547, 694, 20374, 881, 910, 1232, 7229, 1333, 467, 1348, 1363, 1394, 4963,
    1660, 5258, 1594, 11723, 1922, 11483, 2031, 10999, 11630, 17963, 2475, 14977, 2885,
    21808, 4306, 3045, 3351, 11536, 3432, 3456, 3499, 13538, 3506, 1964, 11532, 3787
]

INSTRUMENTS_SEG = [
    0, 0, 0, 0, 0, 0, 0, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1
]



FETCH_INTERVAL = 1
