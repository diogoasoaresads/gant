FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

RUN rm -f /etc/nginx/conf.d/default.conf \
  && mkdir -p /app/data

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
