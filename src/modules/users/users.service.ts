// ... existing code ...
  async findOne(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
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
// ... existing code ...
