#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
mkdir -p backups

# Generate backup filename with timestamp
BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"

print_status "Creating database backup..."

# Create the backup
docker-compose exec -T db pg_dump -U postgres postgres > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    print_success "Database backup created: $BACKUP_FILE"
    
    # Show backup size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_status "Backup size: $BACKUP_SIZE"
    
    # List recent backups
    echo ""
    print_status "Recent backups:"
    ls -la backups/*.sql 2>/dev/null | tail -5
else
    print_error "Database backup failed"
    exit 1
fi
