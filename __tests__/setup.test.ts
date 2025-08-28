describe('Test Setup', () => {
  it('should have environment variables loaded', () => {
    expect(process.env.NEXTAUTH_URL).toBe('http://localhost:3000')
  })

  it('should be running in test environment', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })
})