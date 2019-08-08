FROM node:10-alpine

WORKDIR /app
ADD package.json yarn.lock /app/
RUN yarn --pure-lockfile
ADD . /app
RUN yarn build
RUN yarn install --prod

# Add Tini to resolve PID 1 issue
RUN apk add --no-cache tini
ENTRYPOINT ["tini", "--"]

CMD ["yarn", "start"]
