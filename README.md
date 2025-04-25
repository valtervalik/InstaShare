# InstaShare Setup Guide

This guide provides step-by-step instructions to set up and run the InstaShare server, built with NestJS.

## Prerequisites

Before setting up the project, ensure you have the following installed on your system:

1. **Node.js** (version 16 or newer) - [Download Node.js](https://nodejs.org/)
2. **pnpm** (latest)
3. **Docker**

## Steps to Set Up the Project

Follow these steps to get the project up and running:

### 1. Clone the Repository
Clone the repository to your local machine using the following command:
```bash
git clone https://github.com/valtervalik/InstaShare.git
```

Navigate into the project directory:

```bash
cd InstaShare
```

2. Install Dependencies
Install the required dependencies by running:

```bash
pnpm install
```

3. Configure Environment Variables
Make a copy of .env.example:

```bash
cp .env.example .env
```

4. Run docker containers
```bash
docker compose up -d
```

5. Start the Development Server
Start the development server with the following command:

```bash
pnpm start:dev
```
The application will be accessible at http://localhost:3000 by default.

Building and Running for Production
To build and run the application in production mode, follow these steps:

1. Build the Application
Generate the production build:

```bash
pnpm build
```

2. Start the Production Server
Run the production server:

```bash
pnpm start:prod
```
The application will be available at the configured port (default: 3000).

Testing
Run the tests to ensure everything is working as expected:

```bash
pnpm test
```

Additional Notes
Refer to the package.json file for additional scripts and commands.
Ensure all required environment variables are properly configured before running the application.
If you encounter any issues, check the logs or open an issue in the repository.
