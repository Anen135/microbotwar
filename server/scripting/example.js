module.exports = `# This program runs again every tick for each of your bots.
enemy = nearestEnemy()
resource = nearestResource()

if enemy:
    moveTo(enemy)
    attack(enemy)
else:
    if resource:
        moveTo(resource)
        collect()
    else:
        if random() < 0.05:
            moveTo(random() * 1600, random() * 900)

if canSpawn():
    spawn()`
