FROM node:8-alpine

WORKDIR /app
ADD package.json yarn.lock /app/
RUN yarn --pure-lockfile
ADD . /app
RUN yarn build

CMD ["sh", "-c", "yarn start"]
