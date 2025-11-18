# Up or Down Game

A simple betting game where users can bet on whether the price of a cryptocurrency will go up or down in the next minute.

## Running the application

### Production Environment

1.  Copy `docker-compose.prod.yml` to a Linux amd64 machine
2.  Create a `.env` file with the following variables:

    ```bash
    NODE_ENV="prod"

    # Database Credentials
    DB_ROOT_PASSWORD="<some_password>"
    DB_APP_USER="upordown"
    DB_APP_PASSWORD="<another_password>"
    DB_NAME="upordown"

    # Backend JWT Secret
    JWT_SECRET="<a_long_secret>"
    ```
3.  Run the following command:
    ```bash
    docker compose -f docker-compose.prod.yml up -d
    ```

### Development Environment

1.  Checkout the repository
2.  Prepare the `.env` file the same way as for production, except set `NODE_ENV` to `dev`
3.  Run the following command:
    ```bash
    docker compose -f docker-compose.local.yml up -d
    ```

## Accessing the game

Open your browser and navigate to `http://<your-server-ip>`. The game is accessible on the standard port 80.
