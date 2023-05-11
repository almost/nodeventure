docker build . -t nodeventure
docker run  \
    -p 8989:8989 \
    -v `pwd`/world:/code/world \
    -v `pwd`/src:/code/src \
    -t nodeventure
