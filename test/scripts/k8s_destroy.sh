#!/bin/bash

if [[ $KIND_KEEP_GENERATED_CLUSTER == 0 ]]; then
    echo "-> removing kind cluster..."
    kind delete cluster    
fi