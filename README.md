# @rownd/cli

The official command-line interface for the Rownd authentication platform.

## Installation

```bash
npm install -g @rownd/cli
```

## Quick Start

1. **Authenticate with Rownd:**
   ```bash
   rownd auth login --token your_bearer_token_here
   ```

2. **List your applications:**
   ```bash
   rownd app list --account your_account_id
   ```

3. **Create a new application:**
   ```bash
   rownd app create --name "My New App" --account your_account_id
   ```

## Authentication

The CLI supports multiple authentication methods, checked in order of precedence:

1. **Bearer token flag**: `--token your_token_here`
2. **Environment variable**: `ROWND_API_TOKEN=your_token_here`
3. **Stored credentials**: Use `rownd auth login` to store tokens locally

### Authentication Commands

```bash
# Store authentication token locally
rownd auth login --token your_bearer_token

# Check authentication status
rownd auth status

# Remove stored authentication
rownd auth logout
```

## Application Management

### Basic Operations

```bash
# List applications
rownd app list --account your_account_id

# Get application details
rownd app get your_app_id

# Create a new application
rownd app create --name "My App" --description "App description" --account your_account_id

# Update an application
rownd app update your_app_id --name "Updated Name" --description "New description"

# Delete an application (with confirmation)
rownd app delete your_app_id
```

### Application Schema

```bash
# Get application schema
rownd app schema get your_app_id

# Update schema from JSON string
rownd app schema update your_app_id --schema '{"fields": {"email": {"type": "string"}}}'

# Update schema from file
rownd app schema update your_app_id --schema @schema.json
```

### Application Configuration

```bash
# Get application configuration
rownd app config get your_app_id

# Update configuration from JSON string
rownd app config update your_app_id --config '{"subdomain": "myapp"}'

# Update configuration from file
rownd app config update your_app_id --config @config.json
```

### Application Credentials

```bash
# List application credentials
rownd app creds list your_app_id

# Create new credentials
rownd app creds create your_app_id --name "Production API"

# Get credential details
rownd app creds get your_app_id your_client_id

# Delete credentials (with confirmation)
rownd app creds delete your_app_id your_client_id
```

## User Management

### User Operations

```bash
# List users with pagination
rownd user list your_app_id --page-size 100

# Get specific user
rownd user get your_app_id your_user_id

# Delete user (with confirmation)
rownd user delete your_app_id your_user_id
```

### User Filtering

```bash
# Filter by field values
rownd user list your_app_id --lookup "email:john@example.com"

# Filter by multiple user IDs
rownd user list your_app_id --ids "user1,user2,user3"

# Get specific fields only
rownd user list your_app_id --fields "email,first_name,last_name"

# Pagination
rownd user list your_app_id --page-size 50 --after "last_user_id"
```

### User Data Management

```bash
# Get all user data
rownd user data get your_app_id your_user_id

# Get specific field
rownd user data get your_app_id your_user_id --field email

# Update user data from JSON
rownd user data update your_app_id your_user_id --data '{"email": "new@example.com"}'

# Update user data from file
rownd user data update your_app_id your_user_id --data @user_data.json

# Update specific field
rownd user data update your_app_id your_user_id --field email --value "new@example.com"
```

## Output Formats

The CLI supports two output formats:

### JSON (Default)
```bash
rownd app list --format json
```

### Table Format
```bash
rownd app list --format table
```

Example table output:
```
id                | name        | created_at
app_123          | My App      | 2024-01-01T10:00:00Z
app_456          | Another App | 2024-01-02T11:00:00Z
```

## Global Options

- `--token <token>`: Bearer token for authentication
- `--format <format>`: Output format (`json` or `table`)
- `--quiet`: Suppress non-essential output
- `--verbose`: Show additional debug information
- `--force`: Skip confirmation prompts (where applicable)

## Examples

### Complete Application Setup

```bash
# 1. Authenticate
rownd auth login --token your_bearer_token

# 2. Create application
rownd app create --name "My SaaS App" --account your_account_id

# 3. Update schema
rownd app schema update your_app_id --schema '{
  "fields": {
    "email": {"type": "string", "required": true},
    "first_name": {"type": "string"},
    "last_name": {"type": "string"},
    "company": {"type": "string"}
  }
}'

# 4. Create API credentials
rownd app creds create your_app_id --name "Production API"

# 5. List users
rownd user list your_app_id --format table
```

### Bulk User Management

```bash
# Find all users with gmail addresses
rownd user list your_app_id --lookup "email:*@gmail.com" --format table

# Get all user data for specific users
rownd user list your_app_id --ids "user1,user2,user3" --fields "email,first_name,last_name"

# Update multiple users (requires scripting)
for user_id in user1 user2 user3; do
  rownd user data update your_app_id $user_id --field "company" --value "New Company"
done
```

## Configuration

The CLI stores configuration in `~/.config/rownd/config.json`. This includes:

- Stored authentication tokens
- Default account settings
- API base URL (for development)

You can manually edit this file or use `rownd auth` commands to manage it.

## Error Handling

The CLI provides clear error messages for common scenarios:

- **Authentication errors**: Guidance on fixing credentials
- **Validation errors**: Details on invalid input
- **Network errors**: Suggestions for troubleshooting
- **Rate limiting**: Automatic retry with exponential backoff

## Requirements

- Node.js 18.0.0 or higher
- Valid Rownd account and API credentials

## Development

To contribute to the CLI or run from source:

```bash
# Clone the repository
git clone https://github.com/rownd/cli.git
cd cli

# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link

# Test the CLI
rownd --help
```

## Support

- [Documentation](https://docs.rownd.io/cli)
- [API Reference](https://docs.rownd.io/api)
- [GitHub Issues](https://github.com/rownd/cli/issues)
- [Community Discord](https://discord.gg/rownd)

## License

MIT License - see [LICENSE](LICENSE) file for details.