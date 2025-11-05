# Investigation: "100100" Deposit Bug

## Problem
When depositing $100, the balance displays as "100100" instead of the correct amount (e.g., 200 if balance was 100).

## Root Cause Analysis

### Issue Found: TypeORM Decimal Columns Return Strings
TypeORM `decimal` columns can return values as **strings** instead of numbers. When the frontend receives these as strings and tries to add them, JavaScript performs **string concatenation** instead of numeric addition.

**Example:**
- User balance: `"100"` (string)
- Deposit amount: `100` (number)
- Result: `"100" + 100 = "100100"` ❌ (string concatenation)
- Expected: `100 + 100 = 200` ✅ (numeric addition)

### Fix Applied

**File**: `backend/Seka-Svara-CP-For-Server/src/modules/users/users.service.ts`

**Change**: Updated `findOne()` method to ensure all decimal fields are returned as numbers:

```typescript
async findOne(id: string) {
  const user = await this.usersRepository.findOne({
    where: { id },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // ✅ Ensure balance and platformScore are returned as numbers, not strings
  // TypeORM decimal columns can return as strings, causing string concatenation bugs
  return {
    ...user,
    balance: Number(user.balance) || 0,
    platformScore: Number(user.platformScore) || 0,
    points: Number(user.points) || 0,
    totalWinnings: Number(user.totalWinnings) || 0,
  };
}
```

## Testing

### Test Script Created
`test-deposit.js` - Simulates a deposit and checks for string concatenation bugs.

**Usage:**
```bash
DATABASE_URL="..." node test-deposit.js <userId> <amount>
```

### Frontend Protection
The frontend already uses `Number()` and `parseFloat()` in most places, but the backend fix ensures the API always returns numbers.

## Additional Checks

### Backend Balance Updates
All balance updates in `wallet.service.ts` already use `Number()`:
- ✅ `user.balance = oldBalance + depositAmount` (both are numbers)
- ✅ `wallet.balance = Number(wallet.balance) + depositAmount`

### Frontend Balance Display
All balance displays use `Number()`:
- ✅ `Number(user?.platformScore || 0).toFixed(0)`
- ✅ `parseFloat(amount || 0)`

## Prevention

1. **Backend**: Always convert decimal fields to numbers before returning
2. **Frontend**: Always use `Number()` or `parseFloat()` when working with balance values
3. **API Response**: Ensure all numeric fields are numbers, not strings

## Status

✅ **FIXED** - Backend now ensures all decimal fields are returned as numbers

