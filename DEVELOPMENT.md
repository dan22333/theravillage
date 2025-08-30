# TheraVillage Development Guide

This guide explains how to run the TheraVillage backend locally using Docker Compose.

## 🚀 Quick Start

### 1. Start All Services
```bash
make up
```

### 2. Check Status
```bash
make status
```

### 3. View API Health
```bash
make health
```

## 📋 Available Commands

### Service Management
- `make up` - Start all services in background
- `make up-logs` - Start services and show logs
- `make down` - Stop all services
- `make restart-api` - Restart just the API service

### Development
- `make build` - Rebuild all services
- `make logs` - Show all service logs
- `make api-logs` - Show only API logs
- `make postgres-logs` - Show only database logs

### Database
- `make db-shell` - Access PostgreSQL shell
- `make db-reset` - Reset database (removes all data)
- `make db-info` - Show database information

### Utilities
- `make clean` - Remove all containers and volumes
- `make test` - Run API tests
- `make api-shell` - Access API container shell

## 🌐 Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:8083 | TheraVillage API |
| PostgreSQL | localhost:5433 | Database (external) |

## 🗄️ Database Access

### Via Command Line
```bash
make db-shell
```

### Via Direct Connection
You can also connect directly using any PostgreSQL client:
- Host: `localhost`
- Port: `5433`
- Username: `tv_admin`
- Password: `TheraVillage2024!`
- Database: `theravillage`

## 🔧 Development Workflow

### 1. Start Development Environment
```bash
make up
```

### 2. Make Code Changes
Edit files in `services/api/` - changes will auto-reload thanks to volume mounting.

### 3. View Logs
```bash
make api-logs
```

### 4. Test Changes
```bash
make health
curl http://localhost:8083/
```

### 5. Stop Environment
```bash
make down
```

## 🐛 Troubleshooting

### Port Conflicts
If you get port conflicts, check what's using the ports:
```bash
lsof -i :8083
lsof -i :5433
```

### Database Connection Issues
```bash
make postgres-logs
make db-info
```

### API Issues
```bash
make api-logs
make restart-api
```

### Clean Slate
If everything is broken:
```bash
make clean
make build
make up
```

## 📁 Project Structure

```
theravillage/
├── docker-compose.yml          # Main compose file
├── env.local                   # Local environment variables (NOT committed to git)
├── Makefile                    # Development commands
├── services/
│   └── api/                   # API service
│       ├── Dockerfile         # Production Dockerfile
│       ├── Dockerfile.dev     # Development Dockerfile
│       └── .dockerignore      # Docker ignore rules
├── db/
│   └── migrations/            # Database migrations
└── infra/                     # Infrastructure code
```

## 🔐 Environment Variables

The development environment uses variables from `env.local`:
- `POSTGRES_PASSWORD`: Local database password
- `POSTGRES_USER`: Database username
- `POSTGRES_DB`: Database name
- `API_PORT`: API service port
- `ENVIRONMENT`: Development environment
- `LOG_LEVEL`: Logging level

**Important**: The `env.local` file is NOT committed to git for security.

## 🚀 Next Steps

1. **Add Firebase Admin SDK**: Update `env.local` with your Firebase service account JSON
2. **Run Migrations**: Ensure your database schema is up to date
3. **Add Tests**: Use `make test` to run your test suite
4. **Scale Services**: Add more services to `docker-compose.yml` as needed

## 💡 Tips

- Use `make up-logs` during development to see real-time logs
- The API service has hot-reload enabled - code changes will restart automatically
- Database data persists between restarts unless you use `make db-reset`
- Use `make clean` to start fresh if you encounter issues
- Environment variables are loaded from `env.local` automatically
