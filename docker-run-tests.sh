#!/bin/bash

interval=3
period=1000

function __is_pod_ready() {
  [[ "$(kubectl get po "$1" -o 'jsonpath={.status.conditions[?(@.type=="Ready")].status}')" == 'True' ]]
}

function __wait_pod_ready() {
  for ((i=0; i<$period; i+=$interval)); do
    if __is_pod_ready "$1"; then
      return 0
    fi

    echo "Waiting for $1 to be ready..."
    sleep "$interval"
  done
}

if [[ $KIND_USE_EXISTING_CLUSTER == 0 ]]; then
    echo "-> removing kind cluster..."
    kind delete cluster

    echo "-> creating kind cluster..."
    kind create cluster

    exit_code=$?
    if [[ $exit_code != 0 ]]; then
        echo "<- failed to create kind cluster"
        exit $exit_code
    fi
fi

if [[ -z "$KUBECONFIG" ]]; then
    # export kube config
    export KUBECONFIG="$(kind get kubeconfig-path)"
fi

# copy kubeconfig into default location for test purposes
cp $KUBECONFIG ~/.kube/config

if [[ -n "$KIND_COPY_KUBECONFIG_TO" ]]; then
    cp $KUBECONFIG $KIND_COPY_KUBECONFIG_TO
fi

helm init --wait
kubectl create serviceaccount --namespace kube-system tiller
kubectl create clusterrolebinding tiller-cluster-rule --clusterrole=cluster-admin --serviceaccount=kube-system:tiller
kubectl patch deploy --namespace kube-system tiller-deploy -p '{"spec":{"template":{"spec":{"serviceAccount":"tiller"}}}}'

# navigate to project dir
cd /usr/app

# hack for waiting tiller
sleep 30

kubectl create -f /usr/app/test/intergation/assets/resourcedefinition.yaml

echo "-> install keycloak"
helm install --name keycloak stable/keycloak --wait \
  --set image.tag=4.8.0.Final \
  --set image.repository=jboss/keycloak \
  --set keycloak.username=admin \
  --set keycloak.password=admin \
  --set keycloak.service.type=NodePort \
  --set keycloak.service.nodePort=30800


NODE_HOST=$(kubectl get nodes --namespace default -o jsonpath="{.items[0].status.addresses[0].address}")
sed -i -e 's/localhost/'"$NODE_HOST"'/g' config/default.yml

__wait_pod_ready "keycloak-0"

echo "wait 10 seconds before run tests"
sleep 10

echo "-> running tests..."
yarn test
exit_code=$?

if [[ $KIND_KEEP_GENERATED_CLUSTER == 0 ]]; then
    echo "-> removing kind cluster..."
    kind delete cluster

    echo "-> building ./coverage/coverage.lcov report file..."
    ./node_modules/.bin/nyc report --reporter=text-lcov > ./coverage/coverage.lcov
fi

exit $exit_code
