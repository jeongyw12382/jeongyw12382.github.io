FROM ruby:3.2-bookworm
LABEL maintainer="Amir Pourmand"
# imagemagick for convert, nodejs for JS runtimes, build tools for native gems
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential imagemagick libmagickwand-dev nodejs git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/jekyll
ADD Gemfile /srv/jekyll/
RUN bundle install
