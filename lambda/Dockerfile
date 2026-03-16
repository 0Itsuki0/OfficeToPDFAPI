FROM debian:stable

# If encountered「Could not connect to deb.debian.org:80 (151.101.110.132)」error,
# we can try to set up the proxy like following.
# It might be needed on some machines.
# ENV http_proxy="http://ftp.jp.debian.org"
# ENV https_proxy="http://ftp.jp.debian.org"


#######################
# Font + Local Set Up #
#######################
# Required to display japanese.
# Otherwise japanese characters (and other asian characters) will be tofu-rized...

# Modify contrib.list.
# Needed for installing ttf-mscorefonts-installer
# Using software-properties-common and add-apt-repository like following will not work.
# RUN apt-get update && \
#     apt-get install -y software-properties-common && \
#     add-apt-repository multiverse && \
#     apt-get update && \
#     apt-get install -y ttf-mscorefonts-installer fontconfig && \
#     fc-cache -f -v
# E: Unable to locate package software-properties-common
RUN echo "deb http://deb.debian.org/debian stable contrib non-free" > /etc/apt/sources.list.d/contrib.list

# ubuntu's language-pack-ja does not exist for debian
RUN apt-get update && \
    apt-get install -y locales locales-all

# set locales
# For other languages, use zh_CN.UTF-8, ko_KR.UTF-8, and etc.
# Simply add fonts is not enough.
RUN locale-gen ja_JP.UTF-8
RUN update-locale LANG=ja_JP.UTF-8

# Install necessary fonts
RUN apt-get update && \
    apt-get install -y \
    # fonts for japanese
    fonts-noto-cjk \
    # common microsoft office fonts
    ttf-mscorefonts-installer \
    fontconfig

# Clear font cache
RUN fc-cache -fv


###################################################
# libreoffice + Related Dependencies Installation #
###################################################
# install libreoffice dependencies
RUN apt-get update && \
    apt-get install -y \
    # required for libreoffice to function. Otherwise: Warning: failed to launch javaldx - java may not function correctly
    libreoffice-java-common \
    default-jre-headless \
    libreoffice


########################
# Node JS Installation #
########################
RUN apt-get update && \
    apt-get install -y \
    --no-install-recommends nodejs \
    # npm not coming together with nodejs
    npm


######################
# Web Adapter Set up #
######################
# https://github.com/awslabs/aws-lambda-web-adapter?tab=readme-ov-file
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
# Has to be the same port as that exposing
# default to "8080"
# Please also avoid port 9001 and 3000.
# Lambda Runtime API is on port 9001. CloudWatch Lambda Insight extension uses port 3000.
ENV PORT="8080"
# readiness check path
ENV READINESS_CHECK_PORT="8080"
ENV READINESS_CHECK_PATH="/health-check"


###################################################
# Env Set up Due to Lambda: Read-only file system #
###################################################
# Lambda: Read-only file system
# by default npm writes logs under /home/.npm
ENV NPM_CONFIG_CACHE=/tmp/.npm
# By default, java writes to home/user/.cache/dconf
# Set user.home to /temp
ENV JAVA_OPTS="-Duser.home=/tmp"
# libreoffice needs to create a dir called .cache/dconf in the HOME dir.
# So HOME  must be writable. But on aws lambda, the default HOME is read-only.
ENV HOME=/tmp


##########################
# Regular Epxress Set up #
##########################
WORKDIR /app

# RUN mkdir -p ${FUNCTION_DIR}
COPY package*.json ./

# Install all deps (including dev) so tsc is available for build
RUN npm install

# Install the runtime interface client
# https://docs.aws.amazon.com/lambda/latest/dg/nodejs-image.html#nodejs-image-clients
# RUN npm install aws-lambda-ric

COPY . .
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Expose the port application listens on
# same as the PORT env above
EXPOSE 8080

# Pass the name of the function handler as an argument to the runtime
CMD ["node", "build/index.js"]
