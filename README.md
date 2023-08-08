# Paleo Presto Server

This repo contains the four node.js apps that constitude the Paleo Presto server. These apps live on the Tarry Consistency droplet on Digital Ocean at 134.114.34.6

In addition to the four node apps, the nginx config files are also present. On a linux server, these files live at /etc/nginx/sites-enabled/

Note that several of the node apps have hard-coded references to paths on the current server
