const SparqlEndpointFetcher = require('fetch-sparql-endpoint');

const myFetcher = new SparqlEndpointFetcher();
/*
const myFetcher = new SparqlEndpointFetcher({
	  method: 'POST',                           // A custom HTTP method for issuing (non-update) queries, defaults to POST. Update queries are always issued via POST.
	  additionalUrlParams: new URLSearchParams({'infer': 'true', 'sameAs': 'false'}),  // A set of additional parameters that well be added to fetchAsk, fetchBindings & fetchTriples requests
	  defaultHeaders: new Headers(),            // Optional default headers that will be included in each request
	  fetch: fetch,                             // A custom fetch-API-supporting function
	  dataFactory: DataFactory,                 // A custom RDFJS data factory
	  prefixVariableQuestionMark: false,        // If variable names in bindings should be prefixed with '?', defaults to false
	  timeout: 5000                             // Timeout for setting up server connection (Once a connection has been made, and the response is being parsed, the timeout does not apply anymore).
})*/

const bindingsStream = fetcher.fetchBindings('https://dbpedia.org/sparql', 'SELECT * WHERE { ?s ?p ?o } LIMIT 100');
bindingsStream.on('data', (bindings) => console.log(bindings));
