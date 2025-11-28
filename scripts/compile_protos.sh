# Script to compile Protocol Buffer definitions

# Install required tools
pip install grpcio grpcio-tools

# Compile .proto file to Python
python -m grpc_tools.protoc \
    -I./protos \
    --python_out=./core/grpc_server \
    --python_out=./core/grpc_client \
    --grpc_python_out=./core/grpc_server \
    --grpc_python_out=./core/grpc_client \
    ./protos/stockify.proto

echo "Protocol Buffers compiled successfully!"
