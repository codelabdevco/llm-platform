#!/bin/bash
# ════════════════════════════════════════════════════════════
#   LLM Platform — Auto Deploy Script for Hostinger VPS
#   Domain: kul.hostingervps.com
# ════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 LLM Platform — Deploy Script${NC}"
echo "============================================"

# ─── Step 1: Update system ───────────────────────────────
echo -e "\n${YELLOW}[1/6] Updating system...${NC}"
apt-get update -y && apt-get upgrade -y

# ─── Step 2: Install Docker (if not installed) ──────────
echo -e "\n${YELLOW}[2/6] Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✅ Docker installed${NC}"
else
    echo -e "${GREEN}✅ Docker already installed: $(docker --version)${NC}"
fi

# ─── Step 3: Install Docker Compose (if not installed) ──
echo -e "\n${YELLOW}[3/6] Checking Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# ─── Step 4: Install Git (if not installed) ──────────────
echo -e "\n${YELLOW}[4/6] Checking Git...${NC}"
if ! command -v git &> /dev/null; then
    apt-get install -y git
fi
echo -e "${GREEN}✅ Git ready${NC}"

# ─── Step 5: Setup project ──────────────────────────────
echo -e "\n${YELLOW}[5/6] Setting up project...${NC}"
PROJECT_DIR="/opt/llm-platform"

if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    echo "Created $PROJECT_DIR"
fi

# Copy project files if running from source directory
if [ -f "./docker-compose.yml" ]; then
    echo "Copying project files to $PROJECT_DIR..."
    cp -r ./* "$PROJECT_DIR/"
    cp -r ./.env* "$PROJECT_DIR/" 2>/dev/null || true
fi

cd "$PROJECT_DIR"

# Create .env if not exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Created .env from .env.example — please edit it!${NC}"
    fi
fi

echo -e "${GREEN}✅ Project ready at $PROJECT_DIR${NC}"

# ─── Step 6: Open firewall ports ─────────────────────────
echo -e "\n${YELLOW}[6/6] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 22/tcp
    echo -e "${GREEN}✅ Firewall configured (80, 443, 22)${NC}"
else
    echo "UFW not found, skipping firewall config"
fi

echo ""
echo "============================================"
echo -e "${GREEN}✅ System ready!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit .env file:"
echo "   nano $PROJECT_DIR/.env"
echo ""
echo "2. Add your Anthropic API Key in .env"
echo ""
echo "3. Start the platform:"
echo "   cd $PROJECT_DIR && docker compose up -d --build"
echo ""
echo "4. Check logs:"
echo "   docker compose logs -f"
echo ""
echo "5. Access at: http://kul.hostingervps.com"
echo "============================================"
