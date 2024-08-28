var express = require('express'),
    app = express(),
    dom = require('express-jsdom')(app);

dom.get('/hello', function(document) {
    document.title = 'Hello World';
});
