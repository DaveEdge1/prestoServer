# Front-End Migration Guide

This document lists all URL changes needed to migrate from the multi-server architecture to the consolidated server.

## URL Mapping (Old → New)

| Old URL Pattern | New URL Pattern | Files Affected |
|-----------------|-----------------|----------------|
| `http://143.198.98.66:81/...` | `${BASE_URL}/reconstruct/...` | prestoServer routes |
| `http://143.198.98.66:83/customRecons/...` | `${BASE_URL}/downloads/browse/...` | File browsing |
| `http://143.198.98.66:83/downloads/...` | `${BASE_URL}/downloads/zip/...` | Zip downloads |
| `http://143.198.98.66:85/...` | `${BASE_URL}/editor/...` | Editor routes |
| `http://143.198.98.66:85/querypath...` | `${BASE_URL}/editor/querypath...` | Query path editor |
| `http://143.198.98.66:86/...` | `${BASE_URL}/query/...` | Query UI |
| `http://143.198.98.66:88/...` | `${BASE_URL}/data/...` | MySQL queries |
| `http://143.198.98.66:88/TS...` | `${BASE_URL}/data/TS...` | Time series queries |
| `http://143.198.98.66:89/sparql` | `${BASE_URL}/sparql` | SPARQL queries |
| `http://143.198.98.66:90/lipds` | `${BASE_URL}/lipds` | LiPD data |
| `http://143.198.98.66:91/...` | `${BASE_URL}/viz/...` | Visualizations |
| `http://143.198.98.66:92/...` | `${BASE_URL}/posttsids/...` | PostTSIDs (if needed) |

## Files Requiring Updates

### High Priority (Core Functionality)

#### 1. `query/public/queryHelpers.js`
Main query helper functions - **update these first**.

```javascript
// OLD:
xhr0.open("get", "http://143.198.98.66:88/" + param1, true);
xhr1.open("POST", "http://143.198.98.66:90/lipds", true);
xhr2.get("http://143.198.98.66:88/TS" + params(useCoords=true), true);
xhr3.open("post", "http://143.198.98.66:89/sparql", true);
xhr7.open("post", "http://143.198.98.66:92/", true);
resolve("http://143.198.98.66:85/querypath"...)

// NEW (using relative URLs):
xhr0.open("get", "/data/" + param1, true);
xhr1.open("POST", "/lipds", true);
xhr2.get("/data/TS" + params(useCoords=true), true);
xhr3.open("post", "/sparql", true);
xhr7.open("post", "/posttsids/", true);
resolve("/editor/querypath"...)
```

#### 2. `prestoForm/index2.html`
User redirect after form submission.

```javascript
// OLD:
window.location.href="http://143.198.98.66:86/" + urlParams.get('recon') + "..."

// NEW:
window.location.href="/query/" + urlParams.get('recon') + "..."
```

#### 3. `presto/prestoGo.js` (lines 247, 250, 304)
Email links and result URLs.

```javascript
// OLD:
'http://143.198.98.66:91/'+ uniqueID
"http://143.198.98.66:83/customRecons/"+ uniqueID
'http://143.198.98.66:83/downloads/' + uniqueID

// NEW (use config.baseUrl):
config.baseUrl + '/viz/' + uniqueID
config.baseUrl + '/downloads/browse/' + uniqueID
config.baseUrl + '/downloads/zip/' + uniqueID
```

#### 4. `jsonEditor/editorServer.js` (line 117)
Already migrated to routes/editor.js with config.baseUrl

### Medium Priority (Query HTML Templates)

These files contain the same patterns. Consider:
1. Updating `query/writeQueryForm.js` (the generator)
2. Regenerating HTML files, OR
3. Using `query/public/queryHelpers.js` (if it's shared)

Files to update:
- `query/index.html`
- `query/temp12kRedux.html`
- `query/southernocean.html`
- `query/example.html`
- `query/null.html`
- `query/rasterPlay.html`
- `query/rasterPlay2.html`
- `query/rasterPlay5.html`

### Low Priority (Static Assets)

#### Icon URLs in `query/public/archiveLegend.js`
```javascript
// OLD:
iconUrl: 'http://143.198.98.66:86/glacierIce.png'

// NEW (relative):
iconUrl: '/query/glacierIce.png'
```

### Documentation & Scripts (Can Update Later)
- `query/README.md`
- `query/QUICKSTART.md`
- `query/example.yml`
- `query/compare_tsid_methods.py`
- `query/verify_final_output.py`
- `README.md`
- `MODIFY_LIPDVERSER.md`
- `updateSqlQuery_modified.R`

## Recommended Migration Strategy

### Option A: Use Relative URLs (Recommended)
Change all hardcoded URLs to relative paths. This works because all services now live on the same origin.

```javascript
// Instead of: http://143.198.98.66:88/
// Use: /data/
```

**Pros:**
- Works in any environment (dev, staging, production)
- No configuration needed on front-end
- Simpler to maintain

**Cons:**
- Need to update many files

### Option B: Global BASE_URL Variable
Add a JavaScript config that sets the base URL.

```html
<script>
  window.PRESTO_CONFIG = {
    baseUrl: '' // Empty for relative, or full URL for different origin
  };
</script>
```

Then use:
```javascript
fetch(PRESTO_CONFIG.baseUrl + '/data/' + param1)
```

**Pros:**
- Single place to change for different environments
- Can support CORS if needed later

**Cons:**
- More complex setup
- Need to add config script to all HTML pages

## Quick Find & Replace

For bulk updates, these sed commands can help (run from project root):

```bash
# Update data endpoint (was :88)
sed -i 's|http://143.198.98.66:88/|/data/|g' query/*.html query/public/*.js

# Update lipds endpoint (was :90)
sed -i 's|http://143.198.98.66:90/lipds|/lipds|g' query/*.html query/public/*.js

# Update sparql endpoint (was :89)
sed -i 's|http://143.198.98.66:89/sparql|/sparql|g' query/*.html query/public/*.js

# Update editor endpoint (was :85)
sed -i 's|http://143.198.98.66:85/|/editor/|g' query/*.html query/public/*.js prestoForm/*.html

# Update query/static assets (was :86)
sed -i 's|http://143.198.98.66:86/|/query/|g' query/*.html query/public/*.js prestoForm/*.html

# Update viz endpoint (was :91)
sed -i 's|http://143.198.98.66:91/|/viz/|g' presto/*.js

# Update downloads endpoint (was :83)
sed -i 's|http://143.198.98.66:83/customRecons/|/downloads/browse/|g' presto/*.js
sed -i 's|http://143.198.98.66:83/downloads/|/downloads/zip/|g' presto/*.js
```

## Testing Checklist

After migration, test these workflows:

- [ ] Load main form page (`/forms`)
- [ ] Select reconstruction type and proceed to query (`/query/:recon`)
- [ ] Filter and select data points (calls `/data/` and `/data/TS`)
- [ ] Submit selection (calls `/lipds`)
- [ ] Configure parameters (`/editor/`)
- [ ] Start reconstruction (`/reconstruct/...`)
- [ ] View results (`/viz/:reconID`)
- [ ] Download results (`/downloads/zip/:id`)
- [ ] Browse results (`/downloads/browse/:id`)
