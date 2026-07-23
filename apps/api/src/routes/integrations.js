import { verifyAll, integrations } from '../integrations/index.js';

// GET /integrations/status — verify & report every integration's key + reachability.
export const status = async (req, res) => {
	const result = await verifyAll();
	res.json(result);
};

// GET /integrations/status/:name — verify a single integration.
export const statusOne = async (req, res) => {
	const { name } = req.params;
	const integration = integrations[name];
	if (!integration) {
		return res.status(422).json({ error: `Unknown integration "${name}"`, available: Object.keys(integrations) });
	}
	res.json(await integration.verify());
};
