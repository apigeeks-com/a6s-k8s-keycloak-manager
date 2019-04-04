#!/bin/bash

KC_PORT=30800

echo "-> installing Keycloak..."
helm del --purge keycloak
helm install --name keycloak stable/keycloak --wait \
  --set image.tag=4.8.0.Final \
  --set image.repository=jboss/keycloak \
  --set keycloak.username=admin \
  --set keycloak.password=admin \
  --set keycloak.service.type=NodePort \
  --set keycloak.service.nodePort=$KC_PORT
echo "<- Keycloak installed"

KC_HOST=$(kubectl get nodes --namespace default -o jsonpath="{.items[0].status.addresses[0].address}")

echo "-> waiting for Keycloak to boot"
count=0
until wget http://$KC_HOST:$KC_PORT/auth/ > /dev/null
do
    count=$((count+1))
    if [[ count == 300 ]]; then
        echo 'Keycloak boot timeout.'
        exit 1
    fi
    sleep 1
done
echo "<- Keycloak is up & running"

echo "KC_HOST=$KC_HOST" > /tmp/kc.env
echo "KC_PORT=$KC_PORT" >> /tmp/kc.env