FROM node:10-alpine

WORKDIR /app
ADD package.json yarn.lock /app/
RUN yarn --pure-lockfile
ADD . /app
RUN yarn build
RUN yarn install --prod

CMD ["yarn", "start"]
