# Presto Containerization Plan

## Executive Summary

This document outlines a comprehensive plan to containerize the Paleo Presto Custom Reconstruction Engine, which currently consists of 9 Node.js applications running directly on a Digital Ocean droplet. The containerization will improve deployment reliability, scalability, and maintainability.

## Current Architecture Analysis

### Node.js Applications (9 total)

| Application | Port | File Path | Purpose |
|------------|------|-----------|---------|
| prestoServer | 3000 | presto/prestoServer.js | Main reconstruction launcher |
| downloadServer | 3001 | downloads/downloadServer.js | File downloads and access |
| formServer | 3002 | prestoForm/formServer.js | Configuration form interface |
| editorServer | 3004 | jsonEditor/editorServer.js | Interactive parameter editor |
| queryServer | 3006 | query/queryServer.js | Query interface for lipdverse |
| queryDB | 3007 | query/queryDB.js | MySQL database query handler |
| sparqlServer | 3009 | graphDB/sparqlServer.js | SPARQL GraphDB queries |
| Rserver | 3010 | getLipds/Rserver.js | LiPD data management |
| viz | 3011 | viz/viz.js | Visualization server |

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
   - Containers are launched dynamically by prestoServer

4. **Databases**:
   - MySQL: Time series metadata (21 variables per time series)
   - GraphDB: External service at linkedearth.graphdb.mint.isi.edu

5. **Shared File System**:
   - `/root/presto/userRecons/` - User reconstruction results
   - Configuration files in various reconstruction directories

### Key Dependencies & Challenges

1. **Hard-coded Paths**: Many absolute paths to `/root/presto/`
2. **Shared Volumes**: User reconstruction data must be accessible across services
3. **Docker-in-Docker**: prestoServer launches Docker containers
4. **Database Connectivity**: MySQL connection configuration
5. **Email Service**: nodemailer for sending results
6. **Inter-service Communication**: Services communicate via HTTP

## Containerization Strategy

### Phase 1: Foundation (Preparation)

#### 1.1 Environment Configuration
- Create `.env` file with all configuration variables
- Define environment variables for:
  - Database connections (MySQL host, port, credentials)
  - External service URLs (GraphDB)
  - Email configuration (SMTP settings)
  - Base paths and directories
  - Port mappings

#### 1.2 Code Refactoring (High Priority)
- Replace hard-coded paths with environment variables
- Identify and document all external dependencies
- Update service URLs to use container names instead of localhost
- Create shared configuration module for common settings

### Phase 2: Individual Service Containerization

#### 2.1 Create Docker Images

Each Node.js application should have its own Dockerfile:

**Base Dockerfile Pattern:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

**Services to Containerize:**

1. **presto-server** (prestoServer)
   - Needs Docker socket access (`/var/run/docker.sock`)
   - Requires volume mounts for user reconstruction directories
   - Environment: reconstruction container configurations

2. **download-server** (downloadServer)
   - Needs read access to user reconstruction directories
   - Static file serving capabilities

3. **form-server** (formServer)
   - Needs access to reconstruction configuration templates
   - File upload handling (multer)

4. **editor-server** (editorServer)
   - Static assets for JSON editor UI
   - Access to configuration files

5. **query-server** (queryServer)
   - MySQL client connectivity
   - External GraphDB access

6. **query-db** (queryDB)
   - MySQL connection pool configuration
   - CORS configuration

7. **sparql-server** (sparqlServer)
   - External GraphDB connectivity
   - CORS configuration

8. **rserver** (Rserver/getLipds)
   - Write access to user reconstruction directories
   - CORS configuration

9. **viz-server** (viz)
   - Read access to visualization outputs in user directories
   - Static file serving

### Phase 3: Docker Compose Configuration

#### 3.1 Services Architecture

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "81:81"
      - "83:83"
      - "84:84"
      - "85:85"
      - "90:90"
      - "92:92"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginxConf:/etc/nginx/conf.d:ro
    depends_on:
      - presto-server
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

  presto-server:
    build:
      context: ./presto
    environment:
      - PORT=3000
      - USER_RECONS_PATH=/data/userRecons
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - user-data:/data/userRecons
      - recon-configs:/app/configs:ro
    networks:
      - presto-network
    restart: unless-stopped

  download-server:
    build:
      context: ./downloads
    environment:
      - PORT=3001
      - USER_RECONS_PATH=/data/userRecons
    volumes:
      - user-data:/data/userRecons:ro
    networks:
      - presto-network
    restart: unless-stopped

  form-server:
    build:
      context: ./prestoForm
    environment:
      - PORT=3002
    volumes:
      - recon-configs:/app/configs:ro
    networks:
      - presto-network
    restart: unless-stopped

  editor-server:
    build:
      context: ./jsonEditor
    environment:
      - PORT=3004
    volumes:
      - recon-configs:/app/configs
    networks:
      - presto-network
    restart: unless-stopped

  query-server:
    build:
      context: ./query
      target: query-server
    environment:
      - PORT=3006
      - MYSQL_HOST=mysql
      - MYSQL_DATABASE=lipdverse
      - GRAPHDB_URL=https://linkedearth.graphdb.mint.isi.edu
    networks:
      - presto-network
    restart: unless-stopped
    depends_on:
      - mysql

  query-db:
    build:
      context: ./query
      target: query-db
    environment:
      - PORT=3007
      - MYSQL_HOST=mysql
      - MYSQL_DATABASE=lipdverse
    networks:
      - presto-network
    restart: unless-stopped
    depends_on:
      - mysql

  sparql-server:
    build:
      context: ./graphDB
    environment:
      - PORT=3009
      - GRAPHDB_URL=https://linkedearth.graphdb.mint.isi.edu
    networks:
      - presto-network
    restart: unless-stopped

  rserver:
    build:
      context: ./getLipds
    environment:
      - PORT=3010
      - USER_RECONS_PATH=/data/userRecons
    volumes:
      - user-data:/data/userRecons
    networks:
      - presto-network
    restart: unless-stopped

  viz-server:
    build:
      context: ./viz
    environment:
      - PORT=3011
      - USER_RECONS_PATH=/data/userRecons
    volumes:
      - user-data:/data/userRecons:ro
    networks:
      - presto-network
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=lipdverse
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./query/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - presto-network
    restart: unless-stopped
    ports:
      - "3306:3306"

volumes:
  user-data:
    driver: local
    driver_opts:
      type: none
      device: /root/presto/userRecons
      o: bind
  recon-configs:
    driver: local
  mysql-data:
    driver: local

networks:
  presto-network:
    driver: bridge
```

#### 3.2 Nginx Configuration Updates

Update nginx configuration to use Docker service names:
- `proxy_pass http://presto-server:3000;` instead of `http://127.0.0.1:3000;`
- Similar updates for all other services

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
| Docker-in-Docker issues | Medium | Medium | Test extensively, consider alternatives like Docker socket sharing |
| Performance degradation | Medium | Low | Performance testing, resource allocation tuning |
| Path/configuration errors | Medium | Medium | Comprehensive testing, environment variable validation |
| MySQL connection issues | High | Low | Test database connectivity, connection pooling |
| Volume mount problems | Medium | Medium | Test volume permissions, backup data |

## Success Criteria

1. **Functional Requirements**
   - All 9 services running in containers
   - Reconstruction jobs execute successfully
   - File uploads/downloads working
   - Email notifications delivered
   - Database queries functioning

2. **Performance Requirements**
   - Response times within 10% of current performance
   - No increase in error rates
   - Reconstruction jobs complete in comparable time

3. **Operational Requirements**
   - Easy deployment with single command
   - Automated restarts on failure
   - Comprehensive logging
   - Health monitoring for all services

4. **Security Requirements**
   - No exposed secrets in code or containers
   - Proper network isolation
   - Regular security updates

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
# Database
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=lipdverse
MYSQL_USER=presto_user
MYSQL_PASSWORD=<secure_password>
MYSQL_ROOT_PASSWORD=<secure_root_password>

# External Services
GRAPHDB_URL=https://linkedearth.graphdb.mint.isi.edu

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email_address>
SMTP_PASSWORD=<email_password>

# Paths
USER_RECONS_PATH=/data/userRecons
BASE_URL=http://143.198.98.66

# Server Ports
PRESTO_SERVER_PORT=3000
DOWNLOAD_SERVER_PORT=3001
FORM_SERVER_PORT=3002
EDITOR_SERVER_PORT=3004
QUERY_SERVER_PORT=3006
QUERY_DB_PORT=3007
SPARQL_SERVER_PORT=3009
RSERVER_PORT=3010
VIZ_SERVER_PORT=3011

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
```

### B. Critical Files Requiring Path Updates

1. `presto/prestoServer.js` - User recons path
2. `presto/prestoGo.js` - Container volume mounts
3. `downloads/downloadServer.js` - User recons path
4. `getLipds/Rserver.js` - User recons path
5. `viz/viz.js` - User recons path
6. `query/queryDB.js` - MySQL connection
7. All nginx configuration files - Service URLs

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
