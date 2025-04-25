# Windows 98 dashboard Simulator

This project is a simple web-based simulation of a Windows 98 dashboard environment, allowing users to manage and launch web shortcuts. Configuration is stored server-side using SQLite.

## Running with Docker

This application runs in a single Docker container managed by Supervisor, which runs both the Nginx frontend server and the Flask backend API.

### Prerequisites

*   [Docker](https://docs.docker.com/get-docker/) must be installed on your system.

### Build the Docker Image

Navigate to the project directory (where the `Dockerfile` is located) in your terminal and run the following command to build the Docker image:

```bash
docker build -t win98-dashboard-app .
```

### Run the Docker Container

To ensure your configuration data (icons, positions, size) persists across container restarts, you need to mount a volume for the SQLite database.

**Create a Docker Volume (if it doesn't exist):**
```bash
docker volume create win98-data
```

**Run the container using the volume:**
```bash
docker run -d -p 8181:80 --name win98-dashboard-app -v win98-data:/data win98-dashboard-app
```

Explanation:
*   `-d`: Runs the container in detached mode (in the background).
*   `-p 8181:80`: Maps port 8181 on your host machine to port 80 inside the container (where Nginx is listening). You can change `8181` to another available port if needed.
*   `--name win98-dashboard-app`: Assigns a name to the container for easier management.
*   `-v win98-data:/data`: Mounts the `win98-data` Docker volume to the `/data` directory inside the container. This is where the `config.db` SQLite file will be stored persistently.
*   `win98-dashboard-app`: Specifies the image to run.

### Accessing the Application

After running the container, open your web browser and navigate to:

[http://localhost:8181](http://localhost:8181)

(If you used a different host port in the `docker run` command, replace `8181` accordingly).

Your icon configuration will now be loaded from and saved to the backend API, persisting within the `win98-data` Docker volume.

### Stopping the Container

To stop the running container, use the following command:

```bash
docker stop win98-dashboard-app
```

### Removing the Container

To remove the stopped container (this does **not** remove the `win98-data` volume):

```bash
docker rm win98-dashboard-app
```

### Removing the Data Volume

If you want to completely remove the persisted configuration data:

```bash
docker volume rm win98-data