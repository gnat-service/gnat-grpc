#!/usr/bin/env bash

PROTOC_VER=3.3.0
PROTOC_RELEASE=protoc-$PROTOC_VER-linux-x86_64
PROTOC_ZIP=$PROTOC_RELEASE.zip

curl -OL https://github.com/google/protobuf/releases/download/$PROTOC_VER/$PROTOC_ZIP
mkdir $PROTOC_RELEASE

sudo unzip $PROTOC_ZIP -d $PROTOC_RELEASE/
sudo cp $PROTOC_RELEASE/bin/protoc /usr/local/bin/
sudo cp -a $PROTOC_RELEASE/include/google /usr/local/include/

rm -rf $PROTOC_RELEASE $PROTOC_ZIP
