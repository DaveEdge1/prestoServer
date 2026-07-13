# Presto Containerization Plan

## Executive Summary

This document outlines a comprehensive plan to containerize the Paleo Presto Custom Reconstruction Engine, which currently consists of 9 Node.js applications running directly on a Digital Ocean droplet. The containerization will improve deployment reliability, scalability, and maintainability.

**Revision Note**: This plan has been updated after detailed code review of the core orchestration components (`prestoServer.js`, `prestoGo.js`, and `downloadLipds.js`). The original plan underestimated the complexity of the Docker-in-Docker architecture and the tightly-coupled nature of the job orchestration system.

## Current Architecture Analysis

### Critical Architecture Discovery

After reviewing the core files, the architecture is more nuanced than initially understood:

**prestoServer.js** (presto/prestoServer.js)
- A lightweight Express server (port 3000) that acts as an HTTP trigger
- Does NOT run reconstructions directly - it spawns `prestoGo.js` as a child process
- Each reconstruction request creates a new Node.js process that runs to completion
- Hard-coded paths: `/root/presto/presto/reconLib.json`, `/root/presto/userRecons/`

**prestoGo.js** (presto/prestoGo.js) - THE CORE ORCHESTRATOR
- Long-running background process (NOT a server)
- Orchestrates the entire reconstruction pipeline:
  1. Reads/translates configuration files (YAML/JSON)
  2. Calls `downloadLipds.js` synchronously to gather LiPD data
  3. Launches Docker containers for reconstruction algorithms
  4. Polls for container completion (can take hours)
  5. Launches visualization scripts
  6. Sends result emails via nodemailer
- **SECURITY ISSUE**: Contains hardcoded SMTP credentials (line 193-202)
- Complex Docker volume mounts to external algorithm directories:
  - `/root/holocene_da/` (Python scripts)
  - `/root/temp12k-regional-composites/` (R scripts)

**downloadLipds.js** (getLipds/downloadLipds.js)
- Also spawns Docker containers (`davidedge/lipd_webapps:lipdPickler`)
- Runs R scripts via child_process
- Creates pickle files for Python-based reconstructions
- Downloads archived compilations from lipdverse.org

### Node.js Applications (9 total)

| Application | Port | File Path | Purpose | Container Complexity |
|------------|------|-----------|---------|---------------------|
| prestoServer | 3000 | presto/prestoServer.js | Job launcher (spawns prestoGo.js) | HIGH - Docker socket + child processes |
| downloadServer | 3001 | downloads/downloadServer.js | File downloads and access | LOW - Static file serving |
| formServer | 3002 | prestoForm/formServer.js | Configuration form interface | LOW - Standard Express |
| editorServer | 3004 | jsonEditor/editorServer.js | Interactive parameter editor | LOW - Standard Express |
| queryServer | 3006 | query/queryServer.js | Query interface for lipdverse | MEDIUM - MySQL client |
| queryDB | 3007 | query/queryDB.js | MySQL database query handler | MEDIUM - MySQL client |
| sparqlServer | 3009 | graphDB/sparqlServer.js | SPARQL GraphDB queries | LOW - HTTP client only |
| Rserver | 3010 | getLipds/Rserver.js | LiPD data management | HIGH - Runs R scripts + Docker |
| viz | 3011 | viz/viz.js | Visualization server | LOW - Static file serving |

### Infrastructure Components

1. **Nginx Reverse Proxy**: Routes external traffic to internal services
   - Port 81 → prestoServer (3000)
   - Port 83 → downloadServer (3001)
   - Port 84 → formServer (3002)
   - Port 85 → editorServer (3004)
   - Port 90 → Rserver (3010)
   - Port 92 → postTSidsServer (3012)

2. **Process Management**: Uses `forever` for keeping Node.js processes running

3. **Docker Infrastructure**: Already in use for reconstruction algorithms
   - Images: holocene_da, temp12k, LMR, lipdPickler
   - Containers are launched dynamically by prestoGo.js and downloadLipds.js
   - **Critical**: These are sibling containers, not nested containers

4. **Databases**:
   - MySQL: Time series metadata (21 variables per time series)
   - GraphDB: External service at linkedearth.graphdb.mint.isi.edu

5. **Shared File System**:
   - `/root/presto/userRecons/` - User reconstruction results (CRITICAL shared volume)
   - `/root/presto/prestoForm/` - Form templates and lookup tables
   - `/root/holocene_da/` - Holocene DA algorithm files
   - `/root/temp12k-regional-composites/` - Temp12k R scripts
   - Configuration files in various reconstruction directories

### Key Dependencies & Challenges

1. **Hard-coded Paths**: Extensive use of absolute paths to `/root/presto/` throughout codebase
2. **Shared Volumes**: User reconstruction data must be accessible across ALL services and spawned containers
3. **Docker-in-Docker (Sibling Pattern)**: prestoGo.js and downloadLipds.js launch Docker containers via socket
4. **Child Process Spawning**: prestoServer spawns prestoGo.js; downloadLipds runs R scripts
5. **Database Connectivity**: MySQL connection configuration
6. **Email Service**: nodemailer with HARDCODED credentials (security risk)
7. **Inter-service Communication**: Services communicate via HTTP
8. **Long-running Jobs**: Reconstruction processes can run for hours

## Containerization Strategy

### Recommended Approach: Same-Path Container Mounting (SIMPLIFIED)

After closer review of `prestoGo.js`, there's a much simpler containerization approach:

**Key Insight**: If we mount host paths to the same locations inside the container, the existing code works unchanged. The `docker run` commands in prestoGo.js pass host paths to sibling containers - these paths don't need translation if they're identical inside and outside the orchestrator container.

**What Actually Needs to Change:**
1. **SMTP credentials** (lines 193-202) - MUST move to environment variables (security issue)
2. Mount the Docker socket for sibling container access
3. Ensure R runtime is available for downloadLipds.js

**What Does NOT Need to Change:**
- All the hardcoded `/root/presto/...` paths can stay as-is
- Docker volume mount commands in lines 432-437
- Path references throughout prestoGo.js and downloadLipds.js

### Phase 1: Minimal Required Changes

#### 1.1 Security Fix (REQUIRED - Do This First)

Fix the hardcoded SMTP credentials in `presto/prestoGo.js` lines 193-202:

```javascript
// BEFORE (INSECURE):
let transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    name: 'zoho.com',
    auth: {
        user: "no-reply@paleopresto.com",
        pass: "5-KBS%*YsTneRs4"  // EXPOSED!
    },
    from: 'no-reply@paleopresto.com'
});

// AFTER (SECURE):
let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    name: 'zoho.com',
    auth: {
        user: process.env.SMTP_USER || "no-reply@paleopresto.com",
        pass: process.env.SMTP_PASSWORD  // Required - no default!
    },
    from: process.env.SMTP_FROM || 'no-reply@paleopresto.com'
});
```

#### 1.2 Simple Dockerfile for Orchestrator

```dockerfile
FROM node:18-bullseye

# Install R (required by downloadLipds.js)
RUN apt-get update && apt-get install -y \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
RUN R -e "install.packages(c('lipdR', 'jsonlite', 'magrittr'), repos='https://cran.r-project.org')"

# Install Node.js dependencies
WORKDIR /root/presto
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "presto/prestoServer.js"]
```

#### 1.3 Docker Compose - Same-Path Mounting

```yaml
version: '3.8'

services:
  presto-orchestrator:
    build:
      context: .
      dockerfile: Dockerfile.orchestrator
    environment:
      - NODE_ENV=production
      - PORT=3000
      # SMTP Configuration (REQUIRED)
      - SMTP_HOST=smtp.zoho.com
      - SMTP_PORT=465
      - SMTP_USER=no-reply@paleopresto.com
      - SMTP_PASSWORD=${SMTP_PASSWORD}
      - SMTP_FROM=no-reply@paleopresto.com
    volumes:
      # Docker socket for sibling containers
      - /var/run/docker.sock:/var/run/docker.sock
      # Mount paths IDENTICALLY to host - no code changes needed!
      - /root/presto/userRecons:/root/presto/userRecons
      - /root/presto/prestoForm:/root/presto/prestoForm
      - /root/presto/presto:/root/presto/presto
      - /root/presto/getLipds:/root/presto/getLipds
      - /root/presto/viz:/root/presto/viz
      - /root/holocene_da:/root/holocene_da
      - /root/temp12k-regional-composites:/root/temp12k-regional-composites
    ports:
      - "3000:3000"
    restart: unless-stopped
```

**Why This Works:**
- `prestoGo.js` line 432: `docker run ... -v /root/presto/userRecons/...`
  - This path exists identically in the container AND on the host
  - The Docker socket runs the sibling container on the HOST
  - The sibling container sees `/root/presto/userRecons/` which is a real host path
- No path translation needed!

### Phase 2: Full Stack with Same-Path Approach

### Phase 2: Full Docker Compose Stack

Using the same-path mounting approach, here's a complete docker-compose.yml:

```yaml
version: '3.8'

services:
  # ===========================================
  # ORCHESTRATOR (prestoServer + prestoGo.js)
  # Uses same-path mounting - no code changes!
  # ===========================================
  presto-orchestrator:
    build:
      context: .
      dockerfile: Dockerfile.orchestrator
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SMTP_HOST=smtp.zoho.com
      - SMTP_PORT=465
      - SMTP_USER=no-reply@paleopresto.com
      - SMTP_PASSWORD=${SMTP_PASSWORD}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      # Same paths inside container as on host
      - /root/presto:/root/presto
      - /root/holocene_da:/root/holocene_da
      - /root/temp12k-regional-composites:/root/temp12k-regional-composites
    ports:
      - "3000:3000"
    networks:
      - presto-network
    restart: unless-stopped

  # ===========================================
  # SIMPLE WEB SERVICES (can use different paths)
  # ===========================================

  download-server:
    build:
      context: ./downloads
      dockerfile: Dockerfile
    environment:
      - PORT=3001
    volumes:
      - /root/presto/userRecons:/root/presto/userRecons:ro
    ports:
      - "3001:3001"
    networks:
      - presto-network
    restart: unless-stopped

  form-server:
    build:
      context: ./prestoForm
      dockerfile: Dockerfile
    environment:
      - PORT=3002
    volumes:
      - /root/presto/userRecons:/root/presto/userRecons
      - /root/presto/prestoForm:/root/presto/prestoForm:ro
    ports:
      - "3002:3002"
    networks:
      - presto-network
    restart: unless-stopped

  editor-server:
    build:
      context: ./jsonEditor
      dockerfile: Dockerfile
    environment:
      - PORT=3004
    volumes:
      - /root/presto/userRecons:/root/presto/userRecons
    ports:
      - "3004:3004"
    networks:
      - presto-network
    restart: unless-stopped

  query-server:
    build:
      context: ./query
      dockerfile: Dockerfile.queryServer
    environment:
      - PORT=3006
      - MYSQL_HOST=mysql
      - MYSQL_DATABASE=${MYSQL_DATABASE:-lipdverse}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    networks:
      - presto-network
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy

  query-db:
    build:
      context: ./query
      dockerfile: Dockerfile.queryDB
    environment:
      - PORT=3007
      - MYSQL_HOST=mysql
      - MYSQL_DATABASE=${MYSQL_DATABASE:-lipdverse}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    ports:
      - "3007:3007"
    networks:
      - presto-network
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy

  sparql-server:
    build:
      context: ./graphDB
      dockerfile: Dockerfile
    environment:
      - PORT=3009
      - GRAPHDB_URL=https://linkedearth.graphdb.mint.isi.edu
    ports:
      - "3009:3009"
    networks:
      - presto-network
    restart: unless-stopped

  rserver:
    build:
      context: ./getLipds
      dockerfile: Dockerfile.rserver
    environment:
      - PORT=3010
    volumes:
      - /root/presto/userRecons:/root/presto/userRecons
      - /root/presto/getLipds:/root/presto/getLipds:ro
    ports:
      - "3010:3010"
    networks:
      - presto-network
    restart: unless-stopped

  viz-server:
    build:
      context: ./viz
      dockerfile: Dockerfile
    environment:
      - PORT=3011
    volumes:
      - /root/presto/userRecons:/root/presto/userRecons:ro
    ports:
      - "3011:3011"
    networks:
      - presto-network
    restart: unless-stopped

  # ===========================================
  # DATABASE
  # ===========================================
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${MYSQL_DATABASE:-lipdverse}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - presto-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # ===========================================
  # NGINX REVERSE PROXY
  # ===========================================
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "81:81"
      - "83:83"
      - "84:84"
      - "85:85"
      - "90:90"
      - "91:91"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - presto-orchestrator
      - download-server
      - form-server
    networks:
      - presto-network
    restart: unless-stopped

volumes:
  mysql-data:

networks:
  presto-network:
    driver: bridge
```

### Phase 3: Dockerfiles for Each Service

#### 3.1 Orchestrator Dockerfile (Dockerfile.orchestrator)

```dockerfile
FROM node:18-bullseye

# Install R for downloadLipds.js
RUN apt-get update && apt-get install -y \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
RUN R -e "install.packages(c('lipdR', 'jsonlite', 'magrittr'), repos='https://cran.r-project.org')"

# Set working directory to match host path structure
WORKDIR /root/presto

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "presto/prestoServer.js"]
```

#### 3.2 Simple Service Dockerfile (example: downloads/Dockerfile)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "downloadServer.js"]
```

#### 3.3 R-enabled Service (getLipds/Dockerfile.rserver)

```dockerfile
FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
    r-base r-base-dev \
    libcurl4-openssl-dev libssl-dev libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN R -e "install.packages(c('lipdR', 'jsonlite'), repos='https://cran.r-project.org')"

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENV NODE_ENV=production
EXPOSE 3010
CMD ["node", "Rserver.js"]
```

### Phase 4: Architecture Overview

With the same-path mounting approach, everything runs in containers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HOST SYSTEM                                │
│                                                                      │
│  Host Paths (mounted identically into containers):                   │
│  • /root/presto/userRecons                                          │
│  • /root/presto/prestoForm                                          │
│  • /root/holocene_da                                                │
│  • /root/temp12k-regional-composites                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Docker Compose Stack                         │ │
│  │                                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │  presto-orchestrator (prestoServer + prestoGo.js)       │   │ │
│  │  │  • Mounts: /root/presto → /root/presto (SAME PATH!)     │   │ │
│  │  │  • Docker socket: /var/run/docker.sock                   │   │ │
│  │  │  • Spawns sibling containers via socket                  │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  │                              │                                  │ │
│  │                              │ launches (via Docker socket)     │ │
│  │                              ▼                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │  Sibling Containers (holocene_da, temp12k, lipdPickler) │   │ │
│  │  │  • Run on HOST Docker daemon                             │   │ │
│  │  │  • See /root/presto/userRecons as HOST path              │   │ │
│  │  │  • No path translation needed!                           │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  │                                                                  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │
│  │  │download │ │  form   │ │ editor  │ │  query  │ │ sparql  │  │ │
│  │  │ server  │ │ server  │ │ server  │ │ servers │ │ server  │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │ │
│  │                                                                  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │ │
│  │  │  viz    │ │ rserver │ │  mysql  │ │  nginx  │              │ │
│  │  │ server  │ │         │ │   db    │ │  proxy  │              │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Why Same-Path Works:**
1. prestoGo.js runs `docker run -v /root/presto/userRecons/...`
2. This command goes through the Docker socket to the HOST daemon
3. The HOST daemon mounts the HOST path `/root/presto/userRecons/...`
4. Since the orchestrator container has the same path mounted, both see the same files

### Phase 5: Migration Steps

#### 5.1 Minimal Migration (Just Fix Security + Containerize)

**Step 1: Fix SMTP credentials** (one code change)
```bash
# Edit presto/prestoGo.js lines 193-202
# Change from hardcoded to environment variables
```

**Step 2: Create .env file**
```bash
# .env
SMTP_PASSWORD=<your_actual_password>
MYSQL_ROOT_PASSWORD=<mysql_root_pass>
MYSQL_USER=presto_user
MYSQL_PASSWORD=<mysql_pass>
```

**Step 3: Build and run**
```bash
docker-compose build
docker-compose up -d
```

That's it! No path changes needed.

#### 5.2 Optional Future Improvements

If you later want to decouple from the `/root/presto` path structure, you could:
1. Add environment variables for paths
2. Modify code to use them
3. Change container mount points

But this is **not required** for containerization to work.

## Architecture Improvement Recommendations

After detailed analysis, the current 9-server architecture significantly complicates containerization and maintenance. This section outlines recommended improvements.

### Current State: Why 9 Servers is Problematic

| Issue | Impact |
|-------|--------|
| 9 Node.js processes | 9x memory overhead, 9 containers to manage |
| 9 different ports | Complex nginx configuration, hard-coded port mappings in client code |
| No shared utilities | Duplicated patterns across servers |
| Hard-coded URLs in client JS | `http://143.198.98.66:88`, `:89`, `:90`... tightly coupled to deployment |
| Multiple credential exposures | SMTP in prestoGo.js, MySQL in queryDB.js |

### Recommended: Single Consolidated Server

All 9 servers can be consolidated into **one Express application**:

```
app.js (port 3000)
├── /api/reconstruct     ← prestoServer (1 route)
├── /api/downloads/*     ← downloadServer (3 routes)
├── /api/forms/*         ← formServer (5 routes)
├── /api/editor/*        ← editorServer (3 routes)
├── /api/query/*         ← queryServer (3 routes)
├── /api/data/*          ← queryDB (2 routes)
├── /api/sparql          ← sparqlServer (1 route)
├── /api/lipds           ← Rserver (1 route)
├── /viz/:reconID/*      ← viz (static files)
└── /static/*            ← Static assets
```

**Benefits:**
- **1 container** instead of 9
- **1 port** instead of 9 (simpler nginx, or no nginx needed)
- **Shared middleware** (auth, logging, error handling)
- **Shared database connections** (connection pooling)
- **Simpler client code** (all API calls to same origin)

### Consolidation Effort Estimate

| Phase | Servers | Effort | Risk |
|-------|---------|--------|------|
| 1 | queryServer, viz, downloadServer | 1 day | Low |
| 2 | sparqlServer, prestoServer, Rserver | 1 day | Low |
| 3 | queryDB (needs DB cred refactor) | 1 day | Medium |
| 4 | formServer, editorServer | 2-3 days | Medium |
| **Total** | **All 9** | **5-6 days** | **Low-Medium** |

### Proposed Consolidated Structure

```javascript
// app.js - Single entry point
const express = require('express');
const app = express();

// Shared middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Environment-based configuration
const config = {
  port: process.env.PORT || 3000,
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'lipdverse'
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: process.env.SMTP_PORT || 465,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD
  },
  paths: {
    userRecons: process.env.USER_RECONS_PATH || '/root/presto/userRecons',
    prestoForm: process.env.FORM_PATH || '/root/presto/prestoForm'
  }
};

// Route modules
app.use('/api/reconstruct', require('./routes/reconstruct'));
app.use('/api/downloads', require('./routes/downloads'));
app.use('/api/forms', require('./routes/forms'));
app.use('/api/editor', require('./routes/editor'));
app.use('/api/query', require('./routes/query'));
app.use('/api/data', require('./routes/data'));
app.use('/api/sparql', require('./routes/sparql'));
app.use('/api/lipds', require('./routes/lipds'));
app.use('/viz', require('./routes/viz'));

app.listen(config.port);
```

### Additional Security Fixes Needed

Beyond the SMTP credentials already documented, also fix:

**query/queryDB.js lines 5-10:**
```javascript
// BEFORE (INSECURE):
var con = mysql.createConnection({
  host: "localhost",
  user: "dave",
  password: "***REDACTED***",  // was exposed in git history — rotate
  database: "lipdverse"
});

// AFTER (SECURE):
var con = mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "lipdverse"
});
```

### Decision: Consolidate Before or After Containerization?

**Option A: Containerize First, Then Consolidate**
- Pros: Faster to get into containers, can iterate
- Cons: More complex docker-compose (9 services), more work to change later

**Option B: Consolidate First, Then Containerize** (RECOMMENDED)
- Pros: Simpler containerization (1 service), cleaner architecture
- Cons: Delays containerization by ~1 week

**Recommendation:** Option B. The consolidation effort is small (~5-6 days), and the resulting single-container architecture is dramatically simpler to deploy and maintain.

### Simplified Docker Setup After Consolidation

```yaml
# docker-compose.yml (after consolidation)
version: '3.8'

services:
  presto:
    build: .
    environment:
      - PORT=3000
      - MYSQL_HOST=mysql
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
      - SMTP_HOST=smtp.zoho.com
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /root/presto:/root/presto
      - /root/holocene_da:/root/holocene_da
      - /root/temp12k-regional-composites:/root/temp12k-regional-composites
    ports:
      - "3000:3000"
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=lipdverse
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - presto

volumes:
  mysql-data:
```

**Result: 3 containers instead of 11** (was: 9 Node.js + MySQL + nginx)

### Phase 6: Migration Strategy

#### 4.1 Pre-Migration Checklist

- [ ] Backup all user reconstruction data
- [ ] Backup MySQL database
- [ ] Document current environment variables and configurations
- [ ] Test Docker images locally
- [ ] Verify all hard-coded paths are replaced
- [ ] Create rollback plan

#### 4.2 Migration Steps

1. **Development Testing**
   - Build all Docker images
   - Test docker-compose locally
   - Verify inter-service communication
   - Test reconstruction workflow end-to-end

2. **Staging Deployment**
   - Deploy to staging environment
   - Run integration tests
   - Performance testing
   - Load testing

3. **Production Migration**
   - Schedule maintenance window
   - Stop existing services
   - Export MySQL database
   - Start Docker Compose stack
   - Import MySQL database
   - Smoke tests
   - Monitor logs

4. **Post-Migration Monitoring**
   - Monitor container health
   - Check disk usage
   - Verify email delivery
   - Monitor reconstruction jobs
   - User acceptance testing

#### 4.3 Rollback Plan

If critical issues occur:
1. Stop Docker Compose: `docker-compose down`
2. Restore MySQL database from backup
3. Restart original forever-managed services
4. Restore nginx configuration
5. Verify system functionality

### Phase 5: Optimization & Best Practices

#### 5.1 Health Checks

Add health check endpoints to all services:
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});
```

Add to Docker Compose:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

#### 5.2 Logging Strategy

- Use Docker logging drivers
- Centralized log aggregation (consider ELK stack or similar)
- Structured logging with timestamps
- Log rotation policies

#### 5.3 Security Enhancements

1. **Network Isolation**
   - Create separate networks for different service groups
   - Only expose necessary ports

2. **Secret Management**
   - Use Docker secrets for sensitive data
   - Never commit secrets to git
   - Rotate credentials regularly

3. **Container Security**
   - Run containers as non-root user
   - Use minimal base images (alpine)
   - Regular security scanning of images
   - Keep dependencies updated

#### 5.4 Resource Management

Add resource limits to prevent resource exhaustion:
```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

### Phase 6: CI/CD Pipeline

#### 6.1 Automated Build Pipeline

1. **GitHub Actions / GitLab CI**
   - Trigger on git push
   - Build Docker images
   - Run tests
   - Push to container registry

2. **Image Registry**
   - Use Docker Hub, GitHub Container Registry, or private registry
   - Tag images with version numbers
   - Maintain latest and stable tags

3. **Automated Deployment**
   - Deploy to staging on merge to develop
   - Deploy to production on release tags
   - Automated rollback on health check failures

### Phase 7: Monitoring & Observability

#### 7.1 Container Monitoring

- **Prometheus** + **Grafana** for metrics
- Monitor:
  - CPU and memory usage
  - Request rates and response times
  - Error rates
  - Container restart counts
  - Docker socket usage

#### 7.2 Application Monitoring

- Track reconstruction job success/failure rates
- Monitor email delivery
- Database query performance
- API response times

#### 7.3 Alerts

Set up alerts for:
- Container crashes/restarts
- High resource usage
- Failed reconstruction jobs
- Database connection failures
- Disk space warnings

## Implementation Timeline

### Week 1-2: Preparation
- Code refactoring to remove hard-coded paths
- Create environment variable configuration
- Write Dockerfiles for each service
- Local testing of individual containers

### Week 3-4: Integration
- Create Docker Compose configuration
- Update nginx configuration
- Test inter-service communication
- End-to-end testing in development

### Week 5-6: Testing & Refinement
- Staging environment deployment
- Integration testing
- Performance testing
- Bug fixes and adjustments

### Week 7: Production Migration
- Final pre-migration checks
- Schedule maintenance window
- Execute migration
- Post-migration monitoring
- Documentation updates

### Week 8: Optimization
- Implement monitoring and alerting
- Performance tuning
- Security hardening
- CI/CD pipeline setup

## Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data loss during migration | High | Low | Complete backups, test restore procedures |
| Service downtime | High | Medium | Thorough testing, rollback plan, maintenance window |
| Sibling container path mismatch | High | High | Use HOST_* env vars for Docker -v mounts; extensive testing |
| Docker socket permission issues | Medium | Medium | Test socket access; consider docker group membership |
| R script failures in container | Medium | Medium | Test R package installation; use same R version as host |
| SMTP credential exposure | High | Already occurred | **IMMEDIATE: Move credentials to environment variables** |
| Performance degradation | Medium | Low | Performance testing, resource allocation tuning |
| Path/configuration errors | Medium | High | Comprehensive testing, environment variable validation |
| MySQL connection issues | High | Low | Test database connectivity, connection pooling |
| Volume mount problems | Medium | Medium | Test volume permissions, backup data |
| Long-running job interruption | High | Low | Graceful shutdown handling; job state persistence |

## Success Criteria

### For Hybrid Deployment (Recommended Initial Approach)

1. **Tier 1 & 2 Functional Requirements**
   - 8 services running in containers (all except prestoServer)
   - prestoServer running on host with forever
   - Reconstruction jobs execute successfully via host-based orchestrator
   - File uploads/downloads working
   - Email notifications delivered (with credentials from environment)
   - Database queries functioning

2. **Performance Requirements**
   - Response times within 10% of current performance
   - No increase in error rates
   - Reconstruction jobs complete in comparable time

3. **Operational Requirements**
   - Tier 1/2 deployment with single docker-compose command
   - Automated restarts on failure for containerized services
   - Comprehensive logging
   - Health monitoring for all containerized services

4. **Security Requirements**
   - **SMTP credentials removed from prestoGo.js source code**
   - No exposed secrets in code or containers
   - Proper network isolation between tiers
   - Regular security updates

### For Full Containerization (Future Goal)

1. **Additional Requirements**
   - All 9 services running in containers
   - Sibling container volume mounts working correctly
   - R scripts executing within presto-server container
   - Docker socket properly shared with orchestrator container

## Future Enhancements

1. **Kubernetes Migration**
   - For better scalability and orchestration
   - Auto-scaling based on load
   - Better resource management

2. **Microservices Refinement**
   - Further decomposition of services
   - Message queue for async processing (RabbitMQ/Redis)
   - Separate database per service where appropriate

3. **Cloud-Native Features**
   - Object storage for user data (S3-compatible)
   - Managed database services
   - Load balancing across multiple instances
   - CDN for static assets

4. **Development Workflow**
   - Hot-reload for development
   - Separate dev/staging/prod configurations
   - Integration test suite
   - End-to-end automated testing

## Appendix

### A. Environment Variables (Minimal - Same-Path Approach)

With same-path mounting, you only need these environment variables:

```bash
# ===========================================
# REQUIRED - SMTP (must move from hardcoded!)
# ===========================================
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=no-reply@paleopresto.com
SMTP_PASSWORD=<your_actual_password>  # REQUIRED
SMTP_FROM=no-reply@paleopresto.com

# ===========================================
# REQUIRED - DATABASE
# ===========================================
MYSQL_ROOT_PASSWORD=<secure_root_password>
MYSQL_DATABASE=lipdverse
MYSQL_USER=presto_user
MYSQL_PASSWORD=<secure_password>

# ===========================================
# OPTIONAL
# ===========================================
GRAPHDB_URL=https://linkedearth.graphdb.mint.isi.edu
BASE_URL=http://143.198.98.66
```

### B. Required Code Change (ONLY ONE FILE!)

**File:** `presto/prestoGo.js` lines 193-202

```javascript
// BEFORE (INSECURE - current state):
let transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    name: 'zoho.com',
    auth: {
        user: "no-reply@paleopresto.com",
        pass: "5-KBS%*YsTneRs4"
    },
    from: 'no-reply@paleopresto.com'
});

// AFTER (SECURE):
let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    name: 'zoho.com',
    auth: {
        user: process.env.SMTP_USER || "no-reply@paleopresto.com",
        pass: process.env.SMTP_PASSWORD  // REQUIRED - no default!
    },
    from: process.env.SMTP_FROM || 'no-reply@paleopresto.com'
});
```

### C. Optional Path Changes (NOT needed for containerization)

The following files have hardcoded `/root/presto/...` paths. With same-path mounting, these **do NOT need changes**:

| File | # of Hardcoded Paths | Required for Containerization? |
|------|---------------------|-------------------------------|
| `presto/prestoGo.js` | 30+ | NO (same-path mounting) |
| `presto/prestoServer.js` | 3 | NO |
| `getLipds/downloadLipds.js` | 15+ | NO |
| Other servers | 1-3 each | NO |

Only change these if you want to deploy to a different path structure later

### C. Docker Commands Reference

```bash
# Build all images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop all services
docker-compose down

# Restart a service
docker-compose restart [service-name]

# View running containers
docker-compose ps

# Execute command in container
docker-compose exec [service-name] sh

# View resource usage
docker stats
```

### D. Troubleshooting Guide

**Issue: Container fails to start**
- Check logs: `docker-compose logs [service-name]`
- Verify environment variables
- Check volume mounts and permissions

**Issue: Services can't communicate**
- Verify all services are on the same network
- Check service names in configuration
- Ensure ports are not conflicting

**Issue: MySQL connection fails**
- Verify MySQL container is running
- Check database credentials
- Ensure database is initialized
- Check network connectivity

**Issue: Docker socket permission denied**
- Ensure presto-server has access to Docker socket
- Check volume mount for `/var/run/docker.sock`
- Verify user permissions

**Issue: Volume data not persisting**
- Check volume configuration in docker-compose.yml
- Verify bind mount paths exist
- Check file permissions

**Issue: Sibling container can't access mounted volumes**
- Verify HOST_* environment variables match actual host paths
- The presto-server container uses HOST paths for -v flags, not container paths
- Example: If container path is `/data/userRecons/abc123`, the Docker run command must use `/root/presto/userRecons/abc123` (host path)
- Check that the reconstruction container (holocene_da, temp12k) can write to the mounted directory

**Issue: R scripts fail in Rserver container**
- Check R package installation in container
- Verify lipdR package dependencies are installed
- Check that R version matches expected version
- Look for missing system libraries (libcurl, libssl, libxml2)

**Issue: Email not sending (SMTP errors)**
- Verify SMTP_* environment variables are set
- Check that credentials were moved from hardcoded values
- Test SMTP connectivity from container/host
- Check Zoho SMTP settings and app-specific passwords
