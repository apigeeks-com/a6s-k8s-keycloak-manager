#!/bin/bash

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

kubectl get namespaces
helm ls

# navigate to project dir
cd /usr/app

echo "-> install keycloak-manager"
helm install --name keycloak stable/keycloak --wait \
--set image.tag=4.8.0.Final \
--set image.repository=jboss/keycloak
helm install --name keycloak-manager ./helm/keycloak-manager --wait --set image.tag=latest

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
