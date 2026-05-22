updateSqlQuery <- function(queryTable){

    # ========== EXISTING CODE: Create dataset-level summary ==========
    df1 <- queryTable |>
    dplyr::group_by(datasetId) |>
    dplyr::summarise(dataSetName = datasetIDcollapse(dataSetName),
                     archiveType = datasetIDcollapse(archiveType),
                     TSid = datasetIDcollapse(paleoData_TSid),
                     paleoData_mostRecentCompilations = datasetIDcollapse(paleoData_mostRecentCompilations),
                     interpretation1_seasonality = datasetIDcollapse(interpretation1_seasonality),
                     country = datasetIDcollapse(country),
                     continent = datasetIDcollapse(continent),
                     # Aggregate age and resolution as the UNION (envelope)
                     # of per-TSID values, not the intersection. The previous
                     # max(minAge) / min(maxAge) / max(medianResolution)
                     # stored the time range where *every* TSID had data and
                     # the coarsest per-TSID resolution, which made the
                     # dataset-level filter on /data stricter than the
                     # per-TSID filter on /data/TS used by data cleaning.
                     # Result: the query map under-counted datasets (e.g.
                     # 231 vs 236 for the same filter). With min(minAge) /
                     # max(maxAge) / min(medianResolution), a dataset's
                     # stored span is the full envelope of its TSIDs and its
                     # stored resolution is the finest available, matching
                     # union semantics.
                     medianResolution = min(medianResolution,na.rm = TRUE),
                     interp_Vars = datasetIDcollapse(interp_Vars),
                     paleoData_variableName = datasetIDcollapse(paleoData_variableName),
                     minAge = min(minAge,na.rm = TRUE),
                     maxAge = max(maxAge,na.rm = TRUE),
                     geo_latitude = mean(as.numeric(geo_latitude),na.rm = TRUE),
                     geo_longitude = mean(as.numeric(geo_longitude),na.rm = TRUE),
                     paleoData_proxy = datasetIDcollapse(paleoData_proxy),
                     paleoData_units = datasetIDcollapse(paleoData_units))

    ## Create an sf POINTS object
    points <- data.frame(df1$geo_longitude, df1$geo_latitude)
    pts <- sf::st_as_sf(points, coords=1:2, crs=4326)

    ## Find which points fall over land.
    ## sf::st_intersects() returns an sgbp object (list of integer vectors,
    ## one per point, listing polygon indices the point intersects with).
    ## lengths(sgbp) > 0 is the idiomatic test for "intersects at least one
    ## polygon". The previous as.numeric()/is.na() approach silently produced
    ## NA for every point, marking the entire isTerrestrial column 0.
    ii <- lengths(sf::st_intersects(pts, spData::world)) > 0

    ##Add column for isTerrestrial
    df1 <- cbind.data.frame(df1, isTerrestrial=ii)

    #replace "NA" with NA where this is the unique variable
    df1[df1 == "NA"] <- NA

    #Remove NA where other variables exist
    rmExtraNA <- function(df){
      for(j in 1:nrow(df)){
        for(k in 1:ncol(df)){
          if (grepl(",", df1[j,k])){
            a1 <- unlist(strsplit(df[j,k], ","))
            df[j,k] <- paste0(a1[!a1 == "NA"], collapse = ",")
          }
        }
      }
      df
    }

    df1 <- rmExtraNA(df1)

    # ========== NEW CODE: Prepare time-series level table ==========
    # The queryTable input is already at the time-series level
    # We just need to clean it up for the query table

    print(paste("Preparing to update MySQL tables..."))
    print(paste("  dataSetQuery will have", nrow(df1), "rows (dataset level)"))
    print(paste("  query will have", nrow(queryTable), "rows (time series level)"))

    # Clean up the time-series table
    queryTable_clean <- queryTable
    queryTable_clean[queryTable_clean == "NA"] <- NA

    # ========== DATABASE CONNECTION AND UPDATES ==========
    #connection info
    conInf <- readr::read_tsv("sql.secret",col_names = FALSE,col_types = "c")

    mysqlconnection = RMySQL::dbConnect(RMySQL::MySQL(),
                                        dbname='lipdverse',
                                        host='143.198.98.66',
                                        port=3306,
                                        user=conInf$X1[[1]],
                                        password=conInf$X1[[2]])

    # Update dataSetQuery table (dataset-level aggregation)
    print("Writing to dataSetQuery table...")
    RMySQL::dbWriteTable(mysqlconnection, "dataSetQuery", df1, overwrite=TRUE)
    print("  ✓ dataSetQuery updated")

    # Update query table (time-series level)
    print("Writing to query table...")
    RMySQL::dbWriteTable(mysqlconnection, "query", queryTable_clean, overwrite=TRUE)
    print("  ✓ query updated")

    # Verify the updates
    print("Verifying updates...")

    # Check dataSetQuery count
    dataset_count <- RMySQL::dbGetQuery(mysqlconnection, "SELECT COUNT(*) as count FROM dataSetQuery")
    print(paste("  dataSetQuery now has", dataset_count$count, "rows"))

    # Check query count
    query_count <- RMySQL::dbGetQuery(mysqlconnection, "SELECT COUNT(*) as count FROM query")
    print(paste("  query now has", query_count$count, "rows"))

    # Check Pages2kTemperature versions in query table
    pages2k_check <- RMySQL::dbGetQuery(mysqlconnection,
      "SELECT paleoData_mostRecentCompilations, COUNT(*) as count
       FROM query
       WHERE paleoData_mostRecentCompilations LIKE '%Pages2kTemperature%'
       GROUP BY paleoData_mostRecentCompilations
       ORDER BY paleoData_mostRecentCompilations")

    if(nrow(pages2k_check) > 0) {
      print("  Pages2kTemperature versions in query table:")
      for(i in 1:nrow(pages2k_check)) {
        print(paste("    ", pages2k_check$paleoData_mostRecentCompilations[i], ":",
                    pages2k_check$count[i], "records"))
      }
    }

    # Close connection
    RMySQL::dbDisconnect(mysqlconnection)

    print("✓ Database update complete!")
}
