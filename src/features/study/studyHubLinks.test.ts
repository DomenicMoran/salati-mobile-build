import { STUDY_HUB_GETTING_STARTED_HREF } from './studyHubLinks';

describe('Studium-Hub Einstiege', () => {
  it('verlinkt getting-started prominent im Studium-Hub (VP-A-009)', () => {
    expect(STUDY_HUB_GETTING_STARTED_HREF).toBe('/getting-started');
  });
});
