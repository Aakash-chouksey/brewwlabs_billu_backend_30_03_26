const db = require('../control_plane_models'); 

async function checkPlans() {
  try {
    await db.init();
    const Plan = db.Plan;
    
    if (!Plan) {
        throw new Error('Plan model unreachable');
    }

    const plans = await Plan.findAll(); 
    console.log(JSON.stringify(plans, null, 2)); 
  } catch (err) {
    console.error('🔥 Error checking plans:', err);
  } finally {
    process.exit(0);
  }
}

checkPlans();
