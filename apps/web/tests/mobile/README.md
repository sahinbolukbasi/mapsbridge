# Mobile UI checks

Run from `apps/web`:

```sh
npx playwright install chromium webkit
npm run build
npm run test:mobile
npx playwright show-report
```

Tests serve the production export on `127.0.0.1:4173` and use isolated browser contexts. Account screens use a local fixture token and synthetic messages. External service requests are blocked (font downloads are allowed), so tests do not authenticate, send messages, spend AI credits or change production data.

Coverage includes 320, 375, 390, 430, 768 and 1024px widths; guests and account navigation; Chromium and WebKit; light and dark themes; landscape; reduced motion; touch target size and overlay hit testing; nested-route selection; desktop navigation; compact profile menus; chat pane transitions; and AI route/chat tabs. Screenshots are saved under `test-results`; the HTML report contains failures and traces. This is browser emulation, not a physical iOS/Android device or live backend test.

Additional app experience checks cover mobile start forms, route-code lookup, expandable map sheets, community tabs, profile action bounds, and icon-font delay/failure. The icon font is self-hosted under `public/fonts`; before it is ready, ligature text stays hidden while its layout space is reserved.
