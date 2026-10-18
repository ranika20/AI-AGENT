const app = require('./app');
const { getRuntimeMode } = require('./services/serviceSimulator');

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`AI troubleshooting app listening on http://localhost:${PORT}`);
  console.log(`Current scenario: ${getRuntimeMode()}`);
  console.log('Set SERVICE_MODE to one of: normal, db_down, slow, timeout');
});
