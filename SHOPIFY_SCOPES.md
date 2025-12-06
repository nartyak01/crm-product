# Shopify API Scopes Required

## Metafield Definition Access Options

Khi sử dụng `MERCHANT_READ_WRITE` và `PUBLIC_READ` cho metafield definitions, bạn cần đảm bảo access token có các scopes sau:

### Required Scopes

1. **`write_products`** (Required)
   - Cần thiết để tạo/update/delete metafield definitions với `ownerType: PRODUCT`
   - Cho phép set `access.admin: 'MERCHANT_READ_WRITE'`

2. **`read_products`** (Recommended)
   - Cần thiết để đọc metafield definitions
   - Cho phép query metafield definitions

3. **`unauthenticated_read_metaobjects`** (Optional, for PUBLIC_READ)
   - Cần thiết để set `access.storefront: 'PUBLIC_READ'`
   - Cho phép truy cập metafield qua Storefront API mà không cần authentication

### Access Levels Explained

- **`MERCHANT_READ_WRITE`**: 
  - Cho phép merchant filter metafield trên product list trong Shopify Admin
  - Cho phép sử dụng metafield trong Admin API queries
  - Cho phép sử dụng metafield làm điều kiện trong smart collections

- **`PUBLIC_READ`**: 
  - Cho phép truy cập metafield qua Storefront API
  - Không cần authentication để đọc metafield value
  - Hữu ích cho public-facing applications

### Setting Up Scopes

Khi tạo Shopify App hoặc Private App, đảm bảo request các scopes sau trong OAuth flow:

```
read_products
write_products
unauthenticated_read_metaobjects
```

Hoặc nếu sử dụng Private App, enable các scopes này trong Shopify Admin:
1. Settings → Apps and sales channels → Develop apps
2. Select your app → Configuration
3. Admin API integration scopes → Enable required scopes

### Error Handling

Nếu thiếu scopes, bạn sẽ gặp lỗi khi tạo/update metafield definition:
- `Insufficient access` error
- `Access denied` error
- Mutation fails silently

Kiểm tra scopes của access token bằng cách query:
```graphql
query {
  shop {
    features {
      metafields {
        enabled
      }
    }
  }
}
```

