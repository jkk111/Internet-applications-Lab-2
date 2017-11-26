FROM python:3

WORKDIR /usr/src/app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

ARG port=8888
ENV PORT=$port

EXPOSE $port
COPY . .
CMD [ "python", "./main.py" ]