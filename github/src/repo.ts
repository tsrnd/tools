import GitHub, { GetMembersResponseItem } from '@octokit/rest'
import * as fs from 'fs'
import program from 'commander'

const gh = new GitHub()

function trans(data: GetMembersResponseItem[]): { login: string, repo: number, urls: string[] }[] {
  return data.map(x => { return { login: x.login, repo: 0, urls: [] } })
}

async function getMembers(org: string) {
  try {
    let res = await gh.orgs.getMembers({
      org: org,
      per_page: 100
    })
    let {
      data,
      headers
    } = res
    let users = trans(data)
    while (gh.hasNextPage(headers)) {
      try {
        res = await gh.getNextPage(headers)
        data = res.data
        headers = res.headers
        users = users.concat(trans(data))
      } catch (e) {
        console.error(e)
        return []
      }
    }
    return users
  } catch (e) {
    console.error(e)
    return []
  }
}

async function getRepos(login: string) {
  try {
    let res = await gh.repos.getForUser({
      username: login,
      per_page: 100
    })
    return res.data.map(repo => repo.html_url)
  } catch (e) {
    console.error(e)
    return []
  }
}

async function main(org: string, token: string) {
  if (!(org.length > 0)) {
    console.error('Invalid GitHub Orgnization')
    return
  }

  if (!(token.length === 40)) {
    console.error('Invalid GitHub Access Token')
    return
  }

  gh.authenticate({ type: 'token', token: token })

  console.log(`Getting all members in ${org} org...`)
  let users = await getMembers(org)
  console.log(`Total: ${users.length} members.`)
  console.log('Getting public repositories for each member...')
  for (const user of users) {
    console.log(`Getting public repositories for user ${user.login}...`)
    user.urls = await getRepos(user.login)
    user.repo = user.urls.length
    console.log(`Number of public repositories for user ${user.login}: ${user.repo}`)
  }
  users = users.filter(user => user.repo > 0)
  var json = JSON.stringify(users)
  const file = './report-repo.json'
  fs.writeFile(`${file}`, json, (e) => {
    if (e) {
      console.error(e)
    }
    console.log(`Result is saved to file ${file}`)
  })
}

program
  .option('--org <github org>')
  .option('--token <github access token>')
  .action(() => {
    main(program.org, program.token)
      .then(res => console.log('done'))
      .catch(e => { console.error(e) })
  })
  .parse(process.argv)
