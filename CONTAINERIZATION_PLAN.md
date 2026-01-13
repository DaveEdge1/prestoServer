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

### Recommended Approach: Hybrid Containerization

Given the complexity discovered in the code review, we recommend a **hybrid approach** rather than full containerization of all components. This recognizes that:

1. The job orchestration system (prestoServer + prestoGo.js) has deep integration with the host Docker daemon
2. Reconstruction containers need direct access to host paths
3. Simple web servers can be containerized easily; orchestration components require careful handling

### Phase 1: Foundation (Preparation) - CRITICAL

#### 1.1 Security Remediation (IMMEDIATE)
**Before any containerization, fix the security issue in prestoGo.js:**
```javascript
// CURRENT (INSECURE) - line 193-202:
let transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    auth: {
        user: "no-reply@paleopresto.com",
        pass: "5-KBS%*YsTneRs4"  // EXPOSED PASSWORD!
    },
});

// REQUIRED FIX:
let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: process.env.SMTP_PORT || 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    },
});
```

#### 1.2 Environment Configuration
- Create `.env` file with all configuration variables
- Define environment variables for:
  - Database connections (MySQL host, port, credentials)
  - External service URLs (GraphDB)
  - **Email configuration (SMTP settings) - REMOVE FROM CODE**
  - Base paths and directories
  - Port mappings

#### 1.3 Path Abstraction Strategy

The codebase has extensive hardcoded paths. Here's a mapping of what needs to change:

| Current Path | Environment Variable | Container Path |
|-------------|---------------------|----------------|
| `/root/presto/userRecons/` | `USER_RECONS_PATH` | `/data/userRecons` |
| `/root/presto/presto/` | `PRESTO_APP_PATH` | `/app/presto` |
| `/root/presto/prestoForm/` | `FORM_PATH` | `/app/prestoForm` |
| `/root/presto/getLipds/` | `GETLIPDS_PATH` | `/app/getLipds` |
| `/root/presto/viz/` | `VIZ_PATH` | `/app/viz` |
| `/root/holocene_da/` | `HOLOCENE_DA_PATH` | Keep as host path |
| `/root/temp12k-regional-composites/` | `TEMP12K_PATH` | Keep as host path |

**Key Files Requiring Path Updates:**
- `presto/prestoServer.js` - Lines 10, 27-28
- `presto/prestoGo.js` - Lines 18, 29, 91, 100-103, 117-123, 185, 207-210, 371-392, 412-534 (extensive)
- `getLipds/downloadLipds.js` - Lines 11-12, 16, 115-117, 169, 332, 370-413

#### 1.4 Code Refactoring Priority

**HIGH PRIORITY (prestoGo.js specific):**
1. Extract all paths to environment variables
2. Move email credentials to environment
3. Create a config module that centralizes settings
4. The Docker launch commands in lines 432-437 need special attention:
```javascript
// Current:
var launchText = 'docker run --rm --name ' + uniqueID +
  ' -v /root/presto/userRecons/'+uniqueID+'/lipd.pkl:/proxies/temp12k/Temp12k1_0_2.pkl ' +
  ' -v ' + dirname + ':' + reconParams(recon).resultsDir +
  ' -v ' + configLoc + ':' + reconParams(recon).paramsCon +
  ' -v /root/holocene_da/da_load_proxies.py:/da_load_proxies.py ...'

// These paths must resolve correctly from BOTH:
// 1. Inside the presto-server container (if containerized)
// 2. On the host Docker daemon (where the sibling container runs)
```

**MEDIUM PRIORITY (downloadLipds.js specific):**
1. The R script paths (line 11-12) need environment variables
2. Docker commands for lipdPickler (line 211) need path translation

### Phase 2: Individual Service Containerization

#### 2.1 Service Tiers

Based on code analysis, services fall into three categories:

**Tier 1: Simple Containerization (Low Risk)**
These services are standard Express servers with minimal external dependencies:
- `downloadServer` - Static file serving
- `formServer` - Form handling with file uploads
- `editorServer` - JSON editor UI
- `queryServer` - MySQL queries + GraphDB HTTP calls
- `queryDB` - MySQL queries
- `sparqlServer` - GraphDB HTTP calls
- `viz` - Static file serving

**Tier 2: Complex Containerization (Medium Risk)**
These require R runtime and/or Docker socket access:
- `Rserver` - Runs R scripts, needs R installed in container

**Tier 3: Orchestration Layer (High Risk - Consider Alternatives)**
These spawn child processes and sibling Docker containers:
- `prestoServer` + `prestoGo.js` - The core job orchestrator
- `downloadLipds.js` - Data retrieval with Docker + R

#### 2.2 Tier 1 Services - Standard Dockerfiles

**Base Dockerfile Pattern (Tier 1):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
```

**Tier 1 Services to Containerize:**

1. **download-server** (downloadServer)
   - Needs read access to user reconstruction directories
   - Static file serving capabilities
   - Simple containerization

2. **form-server** (formServer)
   - Needs access to reconstruction configuration templates
   - File upload handling (multer)
   - Writes configs to userRecons directory

3. **editor-server** (editorServer)
   - Static assets for JSON editor UI
   - Access to configuration files

4. **query-server** (queryServer)
   - MySQL client connectivity
   - External GraphDB access

5. **query-db** (queryDB)
   - MySQL connection pool configuration
   - CORS configuration

6. **sparql-server** (sparqlServer)
   - External GraphDB connectivity
   - CORS configuration

7. **viz-server** (viz)
   - Read access to visualization outputs in user directories
   - Static file serving

#### 2.3 Tier 2 Services - R Runtime Required

**Dockerfile for Rserver (requires R):**
```dockerfile
FROM node:18-bullseye

# Install R and required packages
RUN apt-get update && apt-get install -y \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages (this may take a while)
RUN R -e "install.packages(c('lipdR', 'jsonlite'), repos='https://cran.r-project.org')"

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENV NODE_ENV=production
EXPOSE 3010
CMD ["node", "Rserver.js"]
```

#### 2.4 Tier 3 Services - Orchestration (SPECIAL HANDLING)

**The prestoServer + prestoGo.js Challenge:**

This is the most complex component because:
1. `prestoServer.js` spawns `prestoGo.js` as a child process (line 28)
2. `prestoGo.js` runs `downloadLipds.js` synchronously (line 443)
3. `prestoGo.js` launches Docker containers with host path mounts (lines 432-437)
4. `downloadLipds.js` also launches Docker containers (line 211)

**Three Options for Tier 3:**

**Option A: Keep on Host (Recommended Initially)**
- Run prestoServer, prestoGo.js, and downloadLipds.js directly on host
- Containerize only Tier 1 and Tier 2 services
- Lowest risk, fastest path to partial containerization

**Option B: Container with Host Path Passthrough**
```dockerfile
FROM node:18-bullseye

# Install R (needed for downloadLipds.js)
RUN apt-get update && apt-get install -y \
    r-base r-base-dev docker.io \
    libcurl4-openssl-dev libssl-dev libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN R -e "install.packages(c('lipdR', 'jsonlite'), repos='https://cran.r-project.org')"

WORKDIR /app
COPY . .
RUN npm ci --only=production

ENV NODE_ENV=production
# CRITICAL: These paths must match host paths for sibling container mounts
ENV HOST_USER_RECONS_PATH=/root/presto/userRecons
ENV HOST_HOLOCENE_DA_PATH=/root/holocene_da
ENV HOST_TEMP12K_PATH=/root/temp12k-regional-composites

EXPOSE 3000
CMD ["node", "prestoServer.js"]
```

**Key Requirement for Option B:**
The Docker volume mounts in prestoGo.js must use HOST paths, not container paths:
```javascript
// prestoGo.js must be modified to use:
const hostUserReconsPath = process.env.HOST_USER_RECONS_PATH;
// NOT the container's internal path
```

**Option C: Worker Queue Architecture (Future Enhancement)**
- Replace child process spawning with a job queue (Redis/RabbitMQ)
- Separate job scheduler from job executor
- Most scalable but requires significant refactoring

### Phase 3: Docker Compose Configuration

#### 3.1 Hybrid Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HOST SYSTEM                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Docker Compose Stack                         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │
│  │  │download │ │  form   │ │ editor  │ │  query  │ │ sparql  │  │ │
│  │  │ server  │ │ server  │ │ server  │ │ server  │ │ server  │  │ │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │ │
│  │       │           │           │           │           │        │ │
│  │  ┌────┴───────────┴───────────┴───────────┴───────────┴────┐  │ │
│  │  │                    presto-network                        │  │ │
│  │  └────────────────────────────┬────────────────────────────┘  │ │
│  │                               │                                │ │
│  │  ┌─────────┐ ┌─────────┐     │     ┌─────────┐               │ │
│  │  │  viz    │ │ rserver │     │     │  mysql  │               │ │
│  │  │ server  │ │         │     │     │   db    │               │ │
│  │  └─────────┘ └─────────┘     │     └─────────┘               │ │
│  └──────────────────────────────┼────────────────────────────────┘ │
│                                 │                                   │
│  ┌──────────────────────────────┼────────────────────────────────┐ │
│  │         HOST SERVICES (forever-managed)                        │ │
│  │                              │                                  │ │
│  │  ┌─────────────────┐        │                                  │ │
│  │  │  prestoServer   │◄───────┘ (port 3000)                      │ │
│  │  │  (port 3000)    │                                           │ │
│  │  └────────┬────────┘                                           │ │
│  │           │ spawns                                              │ │
│  │           ▼                                                     │ │
│  │  ┌─────────────────┐                                           │ │
│  │  │   prestoGo.js   │──────► Launches sibling containers        │ │
│  │  │  (background)   │        (holocene_da, temp12k, etc.)       │ │
│  │  └────────┬────────┘                                           │ │
│  │           │ calls                                               │ │
│  │           ▼                                                     │ │
│  │  ┌─────────────────┐                                           │ │
│  │  │downloadLipds.js │──────► Launches lipdPickler container     │ │
│  │  │  (synchronous)  │        + runs R scripts                   │ │
│  │  └─────────────────┘                                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  SHARED: /root/presto/userRecons (bind mount to containers)         │
└──────────────────────────────────────────────────────────────────────┘
```

#### 3.2 Docker Compose - Tier 1 & 2 Services Only (Recommended Initial Deployment)

```yaml
version: '3.8'

services:
  # ===========================================
  # NGINX REVERSE PROXY
  # ===========================================
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "83:83"    # downloadServer
      - "84:84"    # formServer
      - "85:85"    # editorServer
      - "86:86"    # queryServer
      - "87:87"    # queryDB
      - "89:89"    # sparqlServer
      - "90:90"    # rserver
      - "91:91"    # viz
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - download-server
      - form-server
      - editor-server
      - query-server
      - query-db
      - sparql-server
      - rserver
      - viz-server
    networks:
      - presto-network
    restart: unless-stopped

  # ===========================================
  # TIER 1: SIMPLE WEB SERVERS
  # ===========================================

  download-server:
    build:
      context: ./downloads
      dockerfile: Dockerfile
    environment:
      - PORT=3001
      - USER_RECONS_PATH=/data/userRecons
    volumes:
      - user-data:/data/userRecons:ro
    networks:
      - presto-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  form-server:
    build:
      context: ./prestoForm
      dockerfile: Dockerfile
    environment:
      - PORT=3002
      - USER_RECONS_PATH=/data/userRecons
      - FORM_TEMPLATES_PATH=/app/templates
    volumes:
      - user-data:/data/userRecons
      - ./prestoForm:/app/templates:ro
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
      - user-data:/data/userRecons
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
      - MYSQL_PORT=3306
      - MYSQL_DATABASE=${MYSQL_DATABASE:-lipdverse}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
      - GRAPHDB_URL=https://linkedearth.graphdb.mint.isi.edu
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
      - MYSQL_PORT=3306
      - MYSQL_DATABASE=${MYSQL_DATABASE:-lipdverse}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
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
    networks:
      - presto-network
    restart: unless-stopped

  viz-server:
    build:
      context: ./viz
      dockerfile: Dockerfile
    environment:
      - PORT=3011
      - USER_RECONS_PATH=/data/userRecons
    volumes:
      - user-data:/data/userRecons:ro
    networks:
      - presto-network
    restart: unless-stopped

  # ===========================================
  # TIER 2: R-ENABLED SERVICE
  # ===========================================

  rserver:
    build:
      context: ./getLipds
      dockerfile: Dockerfile.rserver
    environment:
      - PORT=3010
      - USER_RECONS_PATH=/data/userRecons
    volumes:
      - user-data:/data/userRecons
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
      - ./query/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
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
# VOLUMES
# ===========================================
volumes:
  # CRITICAL: This must be a bind mount to host path
  # so that host-based prestoServer can share data
  user-data:
    driver: local
    driver_opts:
      type: none
      device: /root/presto/userRecons
      o: bind

  mysql-data:
    driver: local

# ===========================================
# NETWORKS
# ===========================================
networks:
  presto-network:
    driver: bridge
```

#### 3.3 Alternative: Full Containerization (Option B from Phase 2)

If you want to containerize prestoServer as well, use this additional service definition:

```yaml
  # ===========================================
  # TIER 3: ORCHESTRATION (OPTIONAL)
  # Only include if you want full containerization
  # ===========================================

  presto-server:
    build:
      context: ./presto
      dockerfile: Dockerfile.orchestrator
    environment:
      - PORT=3000
      # Container-internal paths (for Node.js code)
      - USER_RECONS_PATH=/data/userRecons
      - PRESTO_APP_PATH=/app
      - GETLIPDS_PATH=/app/getLipds
      - VIZ_SCRIPT_PATH=/app/viz/run_script.sh
      # HOST paths (for Docker volume mounts in spawned containers)
      - HOST_USER_RECONS_PATH=/root/presto/userRecons
      - HOST_HOLOCENE_DA_PATH=/root/holocene_da
      - HOST_TEMP12K_PATH=/root/temp12k-regional-composites
      - HOST_PRESTO_FORM_PATH=/root/presto/prestoForm
      # Email (NEVER hardcode these!)
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
    volumes:
      # Docker socket for launching sibling containers
      - /var/run/docker.sock:/var/run/docker.sock
      # User data (must match HOST_USER_RECONS_PATH on host side)
      - /root/presto/userRecons:/data/userRecons
      # Algorithm code (read-only, for visualization scripts)
      - /root/holocene_da:/holocene_da:ro
      - /root/temp12k-regional-composites:/temp12k:ro
      # Form templates
      - ./prestoForm:/app/prestoForm:ro
      # getLipds scripts
      - ./getLipds:/app/getLipds:ro
    networks:
      - presto-network
    restart: unless-stopped
    # Note: This container needs significant resources for R
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 1G
```

#### 3.4 Nginx Configuration Updates

For the hybrid approach, nginx must route to both:
- Container services (via Docker network names)
- Host services (via localhost)

```nginx
# Example nginx.conf for hybrid setup
upstream presto-server {
    # prestoServer still runs on host (Tier 3)
    server host.docker.internal:3000;
}

upstream download-server {
    # Containerized service
    server download-server:3001;
}

# ... similar for other services
```

**Note**: Use `host.docker.internal` to reach host services from within the nginx container on Docker Desktop. On Linux, you may need to use `--add-host=host.docker.internal:host-gateway` or the host's actual IP.

### Phase 3.5: Special Considerations for prestoGo.js and downloadLipds.js

These files are the core of the reconstruction pipeline and require special attention.

#### prestoGo.js Deep Dive

**Current Flow:**
```
prestoServer.js (HTTP request)
    └── spawns prestoGo.js (child process)
            ├── reads/translates config files
            ├── calls downloadLipds.js (synchronous exec)
            │       ├── runs R scripts (child_process.spawn)
            │       └── runs lipdPickler Docker container
            ├── launches reconstruction Docker container
            │       (holocene_da or temp12k)
            ├── polls for container completion
            ├── runs visualization script (bash)
            └── sends email with results
```

**Key Code Locations Requiring Changes:**

| Line(s) | Current Code | Required Change |
|---------|-------------|-----------------|
| 18 | `fs.readFileSync('/root/presto/presto/reconLib.json')` | Use `process.env.PRESTO_APP_PATH + '/reconLib.json'` |
| 29 | `'/root/presto/prestoForm/' + recon + '/lookup.json'` | Use `process.env.FORM_PATH` |
| 91-96 | `'/root/presto/userRecons/' + uniqueID` | Use `process.env.USER_RECONS_PATH` |
| 100-103 | More hardcoded paths to prestoForm | Use environment variables |
| 117-123 | Same pattern | Use environment variables |
| 185-190 | `'/root/presto/userRecons/' + uniqueID` | Use environment variable |
| 193-202 | **HARDCODED SMTP CREDENTIALS** | **CRITICAL: Move to environment** |
| 371-392 | `/root/presto/userRecons/` for viz status | Use environment variable |
| 428 | `var dirname = '/root/presto/userRecons/' + uniqueID` | Use environment variable |
| 432-437 | Docker run command with hardcoded paths | **See special handling below** |
| 443 | `'node /root/presto/getLipds/downloadLipds.js'` | Use environment variable |
| 510-513 | `/root/presto/viz/run_script.sh` | Use environment variable |

**Docker Launch Command Special Handling (lines 432-437):**

The Docker volume mounts in the `docker run` command are critical. When containerized:
- The paths used for `-v` flags must be HOST paths (not container paths)
- The reconstruction containers (holocene_da, temp12k) run as siblings, not children

```javascript
// BEFORE (hardcoded):
var launchText = 'docker run --rm --name ' + uniqueID +
  ' -v /root/presto/userRecons/'+uniqueID+'/lipd.pkl:/proxies/temp12k/Temp12k1_0_2.pkl' +
  ' -v ' + dirname + ':' + reconParams(recon).resultsDir +
  ' -v /root/holocene_da/da_load_proxies.py:/da_load_proxies.py'

// AFTER (environment-aware):
const hostUserRecons = process.env.HOST_USER_RECONS_PATH || '/root/presto/userRecons';
const hostHoloceneDa = process.env.HOST_HOLOCENE_DA_PATH || '/root/holocene_da';

var launchText = 'docker run --rm --name ' + uniqueID +
  ' -v ' + hostUserRecons + '/' + uniqueID + '/lipd.pkl:/proxies/temp12k/Temp12k1_0_2.pkl' +
  ' -v ' + hostUserRecons + '/' + uniqueID + ':' + reconParams(recon).resultsDir +
  ' -v ' + hostHoloceneDa + '/da_load_proxies.py:/da_load_proxies.py'
```

#### downloadLipds.js Deep Dive

**Current Flow:**
```
downloadLipds.js (called by prestoGo.js)
    ├── Checks for existing LiPD data (md5 matching)
    ├── For archived compilations:
    │   └── Downloads from lipdverse.org via curl
    ├── For TSID-based requests:
    │   ├── Runs R script (getLipdSmart.R) to fetch data
    │   ├── Runs Docker container (lipdPickler) to create pickle files
    │   └── Cleans up .lpd files
    └── Exits with status code
```

**Key Code Locations:**

| Line(s) | Current Code | Required Change |
|---------|-------------|-----------------|
| 11-12 | `var file_path = "/root/presto/getLipds/getLipdSmart.R"` | Use `process.env.GETLIPDS_PATH` |
| 16 | `'/root/presto/userRecons/'` | Use `process.env.USER_RECONS_PATH` |
| 86-87 | `'/root/presto/getLipds/updateTSIDmd5.R'` | Use `process.env.GETLIPDS_PATH` |
| 115-117 | `'/root/presto/userRecons/'` paths | Use environment variable |
| 169 | `'/root/presto/userRecons/'` | Use environment variable |
| 211 | Docker command for lipdPickler | Use `HOST_USER_RECONS_PATH` |
| 332 | `'/root/presto/userRecons/'` | Use environment variable |

**Docker Command for lipdPickler (line 211):**
```javascript
// BEFORE:
var dockerComm = "docker run --rm -v " + path1 + ":/output davidedge/lipd_webapps:lipdPickler";

// AFTER (when containerized):
const hostPath = process.env.HOST_USER_RECONS_PATH
  ? path1.replace(process.env.USER_RECONS_PATH, process.env.HOST_USER_RECONS_PATH)
  : path1;
var dockerComm = "docker run --rm -v " + hostPath + ":/output davidedge/lipd_webapps:lipdPickler";
```

#### Recommended Refactoring: Create a Config Module

To simplify the path management, create a shared config module:

```javascript
// config/paths.js
const path = require('path');

module.exports = {
  // Internal paths (used by Node.js code)
  userRecons: process.env.USER_RECONS_PATH || '/root/presto/userRecons',
  prestoApp: process.env.PRESTO_APP_PATH || '/root/presto/presto',
  formPath: process.env.FORM_PATH || '/root/presto/prestoForm',
  getLipdsPath: process.env.GETLIPDS_PATH || '/root/presto/getLipds',
  vizPath: process.env.VIZ_PATH || '/root/presto/viz',

  // Host paths (used for Docker volume mounts when running in container)
  hostUserRecons: process.env.HOST_USER_RECONS_PATH || '/root/presto/userRecons',
  hostHoloceneDa: process.env.HOST_HOLOCENE_DA_PATH || '/root/holocene_da',
  hostTemp12k: process.env.HOST_TEMP12K_PATH || '/root/temp12k-regional-composites',
  hostFormPath: process.env.HOST_PRESTO_FORM_PATH || '/root/presto/prestoForm',

  // Helper function for Docker volume mounts
  toHostPath: function(internalPath) {
    if (process.env.HOST_USER_RECONS_PATH && internalPath.startsWith(this.userRecons)) {
      return internalPath.replace(this.userRecons, this.hostUserRecons);
    }
    return internalPath;
  }
};
```

### Phase 4: Migration Strategy

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

### A. Environment Variables Reference

```bash
# ===========================================
# DATABASE
# ===========================================
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=lipdverse
MYSQL_USER=presto_user
MYSQL_PASSWORD=<secure_password>
MYSQL_ROOT_PASSWORD=<secure_root_password>

# ===========================================
# EXTERNAL SERVICES
# ===========================================
GRAPHDB_URL=https://linkedearth.graphdb.mint.isi.edu

# ===========================================
# EMAIL CONFIGURATION (CRITICAL - remove from code!)
# Current hardcoded values in prestoGo.js line 193-202:
#   host: smtp.zoho.com
#   user: no-reply@paleopresto.com
#   pass: 5-KBS%*YsTneRs4 (EXPOSED!)
# ===========================================
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=no-reply@paleopresto.com
SMTP_PASSWORD=<secure_password>

# ===========================================
# INTERNAL PATHS (used by Node.js code inside containers)
# ===========================================
USER_RECONS_PATH=/data/userRecons
PRESTO_APP_PATH=/app/presto
FORM_PATH=/app/prestoForm
GETLIPDS_PATH=/app/getLipds
VIZ_PATH=/app/viz
BASE_URL=http://143.198.98.66

# ===========================================
# HOST PATHS (for Docker volume mounts in sibling containers)
# These must match actual host filesystem paths
# ===========================================
HOST_USER_RECONS_PATH=/root/presto/userRecons
HOST_HOLOCENE_DA_PATH=/root/holocene_da
HOST_TEMP12K_PATH=/root/temp12k-regional-composites
HOST_PRESTO_FORM_PATH=/root/presto/prestoForm

# ===========================================
# SERVER PORTS
# ===========================================
PRESTO_SERVER_PORT=3000
DOWNLOAD_SERVER_PORT=3001
FORM_SERVER_PORT=3002
EDITOR_SERVER_PORT=3004
QUERY_SERVER_PORT=3006
QUERY_DB_PORT=3007
SPARQL_SERVER_PORT=3009
RSERVER_PORT=3010
VIZ_SERVER_PORT=3011

# ===========================================
# DOCKER
# ===========================================
DOCKER_HOST=unix:///var/run/docker.sock
```

### B. Critical Files Requiring Path Updates (Detailed)

#### B.1 presto/prestoServer.js (4 changes)
| Line | Current | Change To |
|------|---------|-----------|
| 10 | `/root/presto/presto/reconLib.json` | `process.env.PRESTO_APP_PATH + '/reconLib.json'` |
| 27 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 28 | `node /root/presto/presto/prestoGo.js` | `node ${process.env.PRESTO_APP_PATH}/prestoGo.js` |

#### B.2 presto/prestoGo.js (30+ changes - HIGHEST PRIORITY)
| Line | Current | Change To |
|------|---------|-----------|
| 18 | `/root/presto/presto/reconLib.json` | `process.env.PRESTO_APP_PATH + '/reconLib.json'` |
| 29 | `/root/presto/prestoForm/` | `process.env.FORM_PATH + '/'` |
| 91 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 100 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 102 | `/root/presto/prestoForm/` | `process.env.FORM_PATH + '/'` |
| 117 | `/root/presto/prestoForm/` | `process.env.FORM_PATH + '/'` |
| 121 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 123 | `/root/presto/prestoForm/` | `process.env.FORM_PATH + '/'` |
| 185 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 193-202 | **HARDCODED SMTP** | **Use environment variables** |
| 313, 321 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 371, 385 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 390, 412 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 428 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 432-437 | Docker -v paths | Use `HOST_*` env vars |
| 443 | `/root/presto/getLipds/downloadLipds.js` | `process.env.GETLIPDS_PATH + '/downloadLipds.js'` |
| 446, 466, 478, 483 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 492, 496, 504, 510-513, 530 | Various paths | Use environment variables |

#### B.3 getLipds/downloadLipds.js (15+ changes)
| Line | Current | Change To |
|------|---------|-----------|
| 11-12 | `/root/presto/getLipds/getLipdSmart.R` | `process.env.GETLIPDS_PATH + '/getLipdSmart.R'` |
| 16 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 57 | `__dirname` reference | Keep or use GETLIPDS_PATH |
| 86 | `/root/presto/getLipds/updateTSIDmd5.R` | `process.env.GETLIPDS_PATH + '...'` |
| 115-117, 157, 169 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |
| 211 | Docker -v path | Use `HOST_USER_RECONS_PATH` |
| 332, 370, 380-413 | `/root/presto/userRecons/` | `process.env.USER_RECONS_PATH + '/'` |

#### B.4 Other Files
- `downloads/downloadServer.js` - User recons path
- `getLipds/Rserver.js` - User recons path
- `viz/viz.js` - User recons path
- `query/queryDB.js` - MySQL connection (already uses some env vars)
- All nginx configuration files - Service URLs

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
