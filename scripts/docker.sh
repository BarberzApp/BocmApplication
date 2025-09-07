#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

case "$1" in
  "start")
    print_status "Starting Barber App (Production)..."
    docker-compose up -d
    print_success "App is running at http://localhost:3000"
    print_success "Database is running at localhost:5432"
    print_success "Redis is running at localhost:6379"
    ;;
  "dev")
    print_status "Starting Barber App (Development)..."
    docker-compose -f docker-compose.dev.yml up -d
    print_success "Development app is running at http://localhost:3000"
    print_success "Database is running at localhost:5432"
    print_success "Redis is running at localhost:6379"
    print_warning "Hot reloading is enabled for development"
    ;;
  "stop")
    print_status "Stopping Barber App..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down
    print_success "All services stopped"
    ;;
  "build")
    print_status "Building Docker images..."
    docker-compose build
    print_success "Images built successfully"
    ;;
  "logs")
    if [ "$2" = "dev" ]; then
        print_status "Showing development logs..."
        docker-compose -f docker-compose.dev.yml logs -f
    else
        print_status "Showing production logs..."
        docker-compose logs -f
    fi
    ;;
  "restart")
    print_status "Restarting Barber App..."
    docker-compose restart
    print_success "App restarted"
    ;;
  "clean")
    print_status "Cleaning up Docker resources..."
    docker-compose down -v
    docker-compose -f docker-compose.dev.yml down -v
    docker system prune -f
    print_success "Cleanup completed"
    ;;
  "status")
    print_status "Service status:"
    docker-compose ps
    echo ""
    print_status "Development services:"
    docker-compose -f docker-compose.dev.yml ps
    ;;
  "db")
    print_status "Opening database shell..."
    docker-compose exec db psql -U postgres postgres
    ;;
  "redis")
    print_status "Opening Redis CLI..."
    docker-compose exec redis redis-cli
    ;;
  *)
    echo "Usage: $0 {start|dev|stop|build|logs|restart|clean|status|db|redis}"
    echo ""
    echo "Commands:"
    echo "  start   - Start production environment"
    echo "  dev     - Start development environment (with hot reload)"
    echo "  stop    - Stop all services"
    echo "  build   - Build Docker images"
    echo "  logs    - Show logs (add 'dev' for development logs)"
    echo "  restart - Restart production services"
    echo "  clean   - Clean up containers and volumes"
    echo "  status  - Show service status"
    echo "  db      - Open database shell"
    echo "  redis   - Open Redis CLI"
    echo ""
    echo "Examples:"
    echo "  $0 dev"
    echo "  $0 logs dev"
    echo "  $0 db"
    ;;
esac
