#!/bin/bash

# init cluster
bash test/scripts/k8s_init.sh

# register custom resource definiton
kubectl create -f /usr/app/test/intergation/assets/resourcedefinition.yaml

# hack for waiting tiller
#sleep 30

# install Keycloak
bash test/scripts/keycloak_install.sh
. /tmp/kc.env
export KC_HOST=$KC_HOST
export KC_PORT=$KC_PORT

echo "-> running tests for KC: https://$KC_HOST:$KC_PORT"
cd /usr/app
NODE_ENV=test yarn test
exit_code=$?
echo "<- tests execution completed"

# teardown cluster
bash test/scripts/k8s_destroy.sh

echo "-> building ./coverage/coverage.lcov report file..."
./node_modules/.bin/nyc report --reporter=text-lcov > ./coverage/coverage.lcov
echo "-> ./coverage/coverage.lcov created"

exit $exit_code
