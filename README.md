# Stockify RestAPI

## Overview

The Stockify RestAPI is a production-ready REST API designed for fetching and processing option chain and expiry data. Built using FastAPI, it provides a robust and efficient solution for accessing financial market information. The API incorporates Firebase Authentication for secure access, utilizes Redis for caching to optimize performance and reduce latency, and integrates with an external service (Dhan) to retrieve real-time option chain data. This project is designed to be easily deployable using Docker and Docker Compose, and includes comprehensive logging and monitoring capabilities.

## Features

*   **Option Chain Data Retrieval:**
    *   Fetches option chain data for a specified symbol, including call and put option details (Open Interest, Volume, Implied Volatility, Last Traded Price, Delta, Theta, Gamma, Vega, Rho, Theoretical Price, Bid/Ask Prices and Quantities, Moneyness).
    *   Supports filtering of strikes based on user preferences.
    *   Provides PCR (Put Call Ratio) and Max Pain Loss data.
    *   Includes expiry type information.
*   **Expiry Date Retrieval:**
    *   Retrieves available expiry dates for a given symbol.
    *   Cached for performance.
*   **Firebase Authentication:**
    *   Secure user authentication using Firebase.
    *   Integration with Firebase Admin SDK for backend authentication and authorization.
*   **Caching:**
    *   Utilizes Redis for caching API responses.
    *   Implements cache invalidation strategies.
    *   Improves API performance and reduces load on the upstream service.
*   **Rate Limiting:**
    *   Implements rate limiting to protect the API from abuse.
    *   Uses the `slowapi` library for rate limiting.
*   **Settings Management:**
    *   Allows authenticated users to update their preferences (e.g., default strike count).
    *   Stores user preferences in a MySQL database.
*   **Health Check:**
    *   Provides a `/health` endpoint for monitoring the API's status.
*   **Dockerized:**
    *   The application is containerized using Docker for easy deployment and portability.
    *   Uses a multi-stage Dockerfile for optimized image size.
*   **Database Integration:**
    *   Uses MySQL for storing user preferences.
    *   Includes database migrations (if applicable - needs to be confirmed).
*   **Logging:**
    *   Comprehensive logging using the Python `logging` module.
    *   Logs information, warnings, and errors, including stack traces for debugging.
*   **Prometheus Metrics:**
    *   Exposes Prometheus metrics for monitoring and alerting.
    *   Integrates with `prometheus-fastapi-instrumentator`.

## Technologies Used

*   **Python 3.11+:** The primary programming language.
*   **FastAPI:** A modern, fast (high-performance), web framework for building APIs with Python.
*   **Uvicorn:** An ASGI server, used to run the FastAPI application.
*   **aiohttp:** An asynchronous HTTP client/server framework for asyncio. Used for making HTTP requests to the Dhan API.
*   **Redis:** An in-memory data store, used for caching API responses.
*   **SQLAlchemy:** A powerful and versatile SQL toolkit and Object-Relational Mapper (ORM) for Python.
*   **MySQL:** The database used to store user preferences.
*   **Firebase:** Used for user authentication and configuration.
*   **Docker:** A platform for developing, shipping, and running applications in containers.
*   **Docker Compose:** A tool for defining and running multi-container Docker applications.
*   **Prometheus:** An open-source monitoring system.
*   **dotenv:** A Python library for loading environment variables from a `.env` file.
*   **pydantic:** A data validation and settings management library.
*   **asyncio:** A library for writing concurrent code using the async/await syntax.

## Project Structure

```
.
├── .gitignore           # Specifies intentionally untracked files that Git should ignore.
├── app.py               # Main application file, defines the FastAPI app, middleware, and routes.
├── docker-compose.yml   # Defines the services for the application (web, redis, mysql), and their configurations.
├── Dockerfile           # Defines the Docker image for the application, including dependencies and build steps.
├── Get_oc_data.py       # Contains functions to fetch option chain and expiry data from the Dhan API. Includes error handling and retry mechanisms.
├── LICENSE              # Contains the license information for the project (e.g., MIT License).
├── README.md            # This README file, providing project documentation.
├── requirements.txt     # Lists the Python dependencies for the project, used by pip.
├── api/                 # Contains API route definitions, authentication, and authorization logic.
│   ├── auth.py          # Handles user authentication using Firebase, including token verification and user management.
│   └── routes.py        # Defines the API routes for option chain, expiry data, and user settings.
├── core/                # Contains core application components and utilities.
│   ├── config.py        # Defines application settings, including database URLs, API keys, and security configurations.
│   ├── database.py      # Manages database connections and defines database models using SQLAlchemy.
│   ├── limiter.py       # Implements rate limiting using the `slowapi` library.
│   ├── redis_client.py  # Manages Redis connections and provides caching utilities.
│   └── security.py      # Contains security-related utilities, such as password hashing and token generation.
├── crud/                # Contains database CRUD (Create, Read, Update, Delete) operations.
│   └── user_crud.py     # Defines CRUD operations for user data, such as creating, reading, updating, and deleting user records.
├── firebase-credentials.json/ # Firebase service account credentials (not committed to the repository).
├── models/              # Contains data models, defining the structure of data used in the application.
│   ├── db_models.py     # Defines database models using SQLAlchemy (e.g., User, UserPreferences).
│   └── user.py          # Defines user-related models, including data validation using Pydantic.
├── output/              # Contains output data, such as CSV files.
│   ├── 13_exp_data.csv
│   ├── 13_exp_date_data.csv
│   └── 13_oc_data.csv
├── services/            # Contains service layer logic, encapsulating business logic and interacting with external services.
│   ├── expiry_service.py  # Handles fetching and processing expiry dates, including caching.
│   └── option_chain_service.py # Handles fetching and processing option chain data, including caching and data transformations.
└── utils/               # Contains utility functions and helper modules.
    └── csv_saver.py     # Provides functionality for saving data to CSV files.
```

## Prerequisites

*   **Python 3.11+:** Ensure you have a compatible Python version installed.
*   **Docker and Docker Compose:** Required for running the application using Docker.
*   **MySQL:** A MySQL database server is required for storing user preferences. You can run this locally or use a managed service.
*   **Firebase Project and Service Account Credentials:** You will need a Firebase project and service account credentials to enable authentication and access Firebase services.
*   **.env File:** Create a `.env` file in the project root directory to store your environment variables.

## Environment Variables

The application uses environment variables for configuration. Create a `.env` file in the project root directory and populate it with the following variables:

```
DATABASE_URL=mysql://root:your_mysql_password@127.0.0.1:3306/test_db  # Replace with your MySQL connection string
SECRET_KEY=your_secret_key  # A secret key for signing JWT tokens
AUTH_TOKEN=your_dhan_auth_token  # Your Dhan API authentication token
AUTHORIZATION_TOKEN=your_dhan_authorization_token  # Your Dhan API authorization token
FIREBASE_API_KEY=your_firebase_api_key  # Your Firebase API key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain  # Your Firebase auth domain
FIREBASE_DATABASE_URL=your_firebase_database_url  # Your Firebase database URL
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket  # Your Firebase storage bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id  # Your Firebase messaging sender ID
FIREBASE_APP_ID=your_firebase_app_id  # Your Firebase app ID
FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id  # Your Firebase measurement ID
# FIREBASE_CREDENTIALS_JSON= (Optional, if using a JSON file for Firebase credentials)
FIREBASE_PRIVATE_KEY=your_firebase_private_key  # Your Firebase service account private key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email  # Your Firebase service account client email
FIREBASE_CLIENT_ID=your_firebase_client_id  # Your Firebase service account client ID
FIREBASE_CLIENT_CERT_URL=your_firebase_client_cert_url  # Your Firebase service account client certificate URL
```

**Important:** Replace the placeholder values with your actual credentials.  Ensure that sensitive information like `SECRET_KEY`, `AUTH_TOKEN`, `AUTHORIZATION_TOKEN`, and Firebase credentials are kept secure and are not committed to your repository.

## Running the Application

### Using Docker Compose (Recommended)

1.  **Prerequisites:** Ensure you have Docker and Docker Compose installed.
2.  **.env File:** Create a `.env` file in the project root directory and populate it with your environment variables (see above).
3.  **Build and Run:** Execute the following command in your project root directory:

    ```bash
    docker-compose up --build
    ```

    This command will build the Docker image (if necessary) and start the application, along with the Redis and MySQL containers.
4.  **Access the API:** Once the containers are running, the API will be accessible at `http://localhost:8000`.

### Without Docker Compose (for development)

1.  **Prerequisites:** Ensure you have Python 3.11+ installed and that you have a MySQL server running.
2.  **.env File:** Create a `.env` file in the project root directory and populate it with your environment variables (see above).
3.  **Install Dependencies:** Install the required Python packages using pip:

    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the Application:** Run the FastAPI application using:

    ```bash
    python app.py
    ```

5.  **Access the API:** The API will be accessible at `http://localhost:8000`.

## API Endpoints

The API provides the following endpoints:

*   `/health`:
    *   **Method:** `GET`
    *   **Description:** Returns a JSON response indicating the API's health status.
    *   **Example Response:** `{"status": "healthy"}`
*   `/api/settings`:
    *   **Method:** `PUT`
    *   **Description:** Updates user preferences. Requires authentication.
    *   **Request Body:**  A JSON object containing the user preferences (e.g., `{"default_strike_count": 25}`).
    *   **Authentication:** Requires a valid Firebase authentication token in the `Authorization` header (e.g., `Bearer <token>`).
    *   **Example Request:**
        ```
        PUT /api/settings HTTP/1.1
        Host: localhost:8000
        Authorization: Bearer <token>
        Content-Type: application/json

        {
          "default_strike_count": 25
        }
        ```
    *   **Example Response:** (Based on successful update)
        ```json
        {
          "default_strike_count": 25
        }
        ```
*   `/api/option-chain`:
    *   **Method:** `GET`
    *   **Description:** Retrieves option chain data for a specified symbol and expiry. Requires authentication.
    *   **Parameters:**
        *   `symbol_seg`: (Required) The symbol segment (e.g., 1 for NSE).
        *   `symbol_sid`: (Required) The symbol ID.
        *   `symbol_exp`: (Optional) The expiry timestamp. If not provided, the service will attempt to determine the expiry date.
        *   `strike_count`: (Optional) The number of strikes around ATM to return (defaults to user preference).
    *   **Authentication:** Requires a valid Firebase authentication token in the `Authorization` header (e.g., `Bearer <token>`).
    *   **Example Request:**
        ```
        GET /api/option-chain?symbol_seg=1&symbol_sid=12345&symbol_exp=1678886400&strike_count=20 HTTP/1.1
        Host: localhost:8000
        Authorization: Bearer <token>
        ```
    *   **Example Response:** (Truncated for brevity)
        ```json
        {
          "status": "success",
          "data": [
            {
              "17000.0": {
                "CE": {
                  "OI": 12345,
                  "OI_Change": 100,
                  "Implied_Volatility": 0.25,
                  "Last_Traded_Price": 10.5,
                  "Volume": 5000,
                  "Delta": 0.6,
                  "Theta": -0.05,
                  "Gamma": 0.02,
                  "Vega": 0.1,
                  "Rho": 0.01,
                  "Theoretical_Price": 10.4,
                  "Bid_Price": 10.4,
                  "Ask_Price": 10.6,
                  "Bid_Quantity": 100,
                  "Ask_Quantity": 150,
                  "Moneyness": "ATM"
                },
                "PE": {
                  "Open_Interest": 20000,
                  "OI_Change": -50,
                  "Implied_Volatility": 0.3,
                  "Last_Traded_Price": 5.2,
                  "Volume": 7000,
                  "Delta": -0.4,
                  "Theta": -0.03,
                  "Gamma": 0.01,
                  "Vega": 0.08,
                  "Rho": -0.005,
                  "Theoretical_Price": 5.1,
                  "Bid_Price": 5.1,
                  "Ask_Price": 5.3,
                  "Bid_Quantity": 200,
                  "Ask_Quantity": 180,
                  "Moneyness": "ATM"
                },
                "OI_PCR": 1.2,
                "Volume_PCR": 1.4,
                "Max_Pain_Loss": 17000.0,
                "Expiry_Type": "Weekly"
              }
            }
          ],
          "fut_data": {
            "12345": {
              "v_chng": 100,
              "v_pchng": 0.5,
              "sid": 12345,
              "ltp": 17000.0,
              "pc": 17000.0,
              "vol": 10000,
              "sym": "SYMBOL",
              "oi": 50000,
              "oichng": 1000,
              "pvol": 0,
              "oipchng": 2
            }
          },
          "market_data": {
            "lot_size": 100,
            "atm_iv": 0.28,
            "iv_change": 0.01,
            "spot_price": 17000.0,
            "spot_change": 50.0,
            "spot_change_percent": 0.3,
            "OI_call": 250000,
            "OI_put": 300000,
            "io_ratio": 1.2,
            "days_to_expiry": 7
          },
          "metadata": {
            "symbol_seg": 1,
            "symbol_sid": 12345,
            "symbol_exp": 1678886400,
            "total_strikes": 20,
            "processing_time": "0.123s",
            "from_cache": false,
            "cached_at": 1678886400
          }
        }
        ```
*   `/api/expiry-dates`:
    *   **Method:** `GET`
    *   **Description:** Retrieves expiry dates for a specified symbol. Requires authentication.
    *   **Parameters:**
        *   `symbol_seg`: (Required) The symbol segment.
        *   `symbol_sid`: (Required) The symbol ID.
    *   **Authentication:** Requires a valid Firebase authentication token in the `Authorization` header (e.g., `Bearer <token>`).
    *   **Example Request:**
        ```
        GET /api/expiry-dates?symbol_seg=1&symbol_sid=12345 HTTP/1.1
        Host: localhost:8000
        Authorization: Bearer <token>
        ```
    *   **Example Response:**
        ```json
        {
          "status": "success",
          "data": [
            1678886400,
            1679491200,
            1680182400
          ],
          "metadata": {
            "symbol_seg": 1,
            "symbol_sid": 12345,
            "curr_exp": 1678886400,
            "total_expiries": 3,
            "processing_time": "0.050s",
            "from_cache": false,
            "cached_at": 1678886400
          }
        }
        ```

## Authentication Details

*   **Firebase Integration:** The API uses Firebase Authentication for user authentication.
*   **Authentication Flow:**
    1.  The client application authenticates the user using Firebase SDK (e.g., via email/password, Google sign-in, etc.).
    2.  Upon successful authentication, Firebase provides a JWT (JSON Web Token) to the client.
    3.  The client includes this JWT in the `Authorization` header of subsequent API requests (e.g., `Authorization: Bearer <token>`).
    4.  The API validates the JWT using the Firebase Admin SDK.
    5.  If the token is valid, the API allows access to protected resources.
*   **Firebase Admin SDK:** The backend uses the Firebase Admin SDK to verify the JWTs and manage user sessions.

## Rate Limiting

*   The API utilizes rate limiting to prevent abuse and ensure fair usage.
*   The `/api/option-chain` and `/api/expiry-dates` endpoints are rate-limited to 100 requests per minute per IP address.
*   The `slowapi` library is used to implement rate limiting.

## Monitoring

*   **Prometheus Metrics:** The API exposes Prometheus metrics at the `/metrics` endpoint.
*   **Metrics Available:** The following metrics are available:
    *   `requests_total`: A counter of the total number of requests.
    *   `request_processing_seconds`: A summary of the request processing time.
*   **Monitoring Tools:** You can use tools like Prometheus and Grafana to collect, visualize, and alert on these metrics.

## Contributing

We welcome contributions! If you're interested in contributing to the project, please follow these steps:

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix.
3.  **Make your changes** and commit them with clear and concise commit messages.
4.  **Submit a pull request** to the main branch of the repository.

## License

MIT License

Copyright (c) 2025 DeepStacker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
