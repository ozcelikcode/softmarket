.PHONY: dev migrate seed backup restore deploy provision logs typecheck lint test

dev:
	pnpm dev
migrate:
	pnpm migrate
seed:
	pnpm ensure-forms
	pnpm content:import
backup:
	bash scripts/backup.sh
restore:
	bash scripts/restore.sh "$(BACKUP)"
deploy:
	bash scripts/deploy.sh
provision:
	bash scripts/provision.sh
logs:
	ssh "$(DEPLOY_HOST)" journalctl -u softmarket -f
typecheck:
	pnpm typecheck
lint:
	pnpm lint
test:
	pnpm test
