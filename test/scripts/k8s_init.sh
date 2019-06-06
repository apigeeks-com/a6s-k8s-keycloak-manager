#!/bin/bash

EXISTING_CLUSTERS=$(kind get clusters)

if [[ $KIND_USE_EXISTING_CLUSTER == 0 ]]; then
    if [[ "${EXISTING_CLUSTERS}x" != "x" ]]; then
      echo "-> removing kind cluster..."
      kind delete cluster
      echo "<- kind cluster removed"
    fi

    echo "-> creating kind cluster..."
    kind create cluster
   
    exit_code=$?
    if [[ $exit_code != 0 ]]; then
        echo "<- failed to create kind cluster"
        exit $exit_code
    fi
    echo "<- kind cluster created"   
fi

if [[ -z "$KUBECONFIG" ]]; then
    # export kube config
    export KUBECONFIG="$(kind get kubeconfig-path)"
fi

if kubectl get pod -n kube-system | grep tiller; then
  echo "-- tiller already installed"
else
  echo "-> installing tiller..."
  helm init --wait
  kubectl create serviceaccount --namespace kube-system tiller
  kubectl create clusterrolebinding tiller-cluster-rule --clusterrole=cluster-admin --serviceaccount=kube-system:tiller
  kubectl patch deploy --namespace kube-system tiller-deploy -p '{"spec":{"template":{"spec":{"serviceAccount":"tiller"}}}}'
  echo "<- tiller installed"  

  echo "-> waiting for tiller to boot..."
  until kubectl get pod -n kube-system | grep tiller | grep 1/1 | grep Running > /dev/null
  do
    sleep 1
  done  
  echo "<- tiller started"  
fi

# copy kubeconfig into default location for test purposes
cp $KUBECONFIG ~/.kube/config

if [[ -n "$KIND_COPY_KUBECONFIG_TO" ]]; then
    cp $KUBECONFIG $KIND_COPY_KUBECONFIG_TO
fi