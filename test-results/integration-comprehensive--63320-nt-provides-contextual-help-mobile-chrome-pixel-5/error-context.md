# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "📊 Perf" [ref=e3]
  - button "Open Next.js Dev Tools" [ref=e9] [cursor=pointer]:
    - img [ref=e10]
  - alert [ref=e13]
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Sign in to your account" [level=2] [ref=e17]
      - paragraph [ref=e18]: AI-Powered Project Portfolio Management
    - generic [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: Email Address *
          - textbox "Email Address *" [ref=e23]:
            - /placeholder: Enter your email address
        - generic [ref=e24]:
          - generic [ref=e25]: Password *
          - textbox "Password *" [ref=e26]:
            - /placeholder: Enter your password
      - button "Sign In" [ref=e28]
      - generic [ref=e29]:
        - button "Need an account? Sign up" [ref=e30]
        - link "Forgot password?" [ref=e31] [cursor=pointer]:
          - /url: /forgot-password
```