import {
  Alert,
  AlertIcon,
  Center,
  Flex,
  Heading,
  Icon,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { useConfig } from '@nft/hooks'
import { HiBadgeCheck } from '@react-icons/all-files/hi/HiBadgeCheck'
import { useWeb3React } from '@web3-react/core'
import { NextPage } from 'next'
import Trans from 'next-translate/Trans'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Head from '../../components/Head'
import Link from '../../components/Link/Link'
import BackButton from '../../components/Navbar/BackButton'
import type { Props as NFTCardProps } from '../../components/Token/Card'
import TokenCard from '../../components/Token/Card'
import type { FormData } from '../../components/Token/Form/Create'
import TokenFormCreate from '../../components/Token/Form/Create'
import connectors from '../../connectors'
import environment from '../../environment'
import {
  Config,
  FetchAccountDocument,
  FetchAccountQuery,
  useFetchAccountQuery,
} from '../../graphql'
import useBlockExplorer from '../../hooks/useBlockExplorer'
import useEagerConnect from '../../hooks/useEagerConnect'
import useLocalFileURL from '../../hooks/useLocalFileURL'
import useSigner from '../../hooks/useSigner'
import SmallLayout from '../../layouts/small'
import { wrapServerSideProps } from '../../props'
import { values as traits } from '../../traits'

type Props = {
  multiple: boolean
  currentAccount: string | null
}

export const getServerSideProps = wrapServerSideProps<Props>(
  environment.GRAPHQL_URL,
  async (context, client) => {
    const { data, error } = await client.query<FetchAccountQuery>({
      query: FetchAccountDocument,
      variables: {
        account: context.user.address || '',
      },
    })
    if (error) throw error
    if (!data) throw new Error('data is falsy')
    return {
      props: {
        multiple: context.query.type === 'multiple',
        currentAccount: context.user.address,
      },
    }
  },
)

const Layout = ({ children }: { children: React.ReactNode }) => (
  <SmallLayout>
    <Head
      title="Create Collectible"
      description="Create Collectible securely stored on blockchain"
    />
    {children}
  </SmallLayout>
)

const CreatePage: NextPage<Props> = ({ currentAccount, multiple }) => {
  const ready = useEagerConnect()
  const signer = useSigner()
  const { t } = useTranslation('templates')
  const { back, push } = useRouter()
  const { account } = useWeb3React()
  const configPromise = useConfig()
  const [config, setConfig] = useState<Config>()
  const toast = useToast()
  const { data } = useFetchAccountQuery({
    variables: {
      account: (ready ? account?.toLowerCase() : currentAccount) || '',
    },
  })

  const [formData, setFormData] = useState<Partial<FormData>>()

  const blockExplorer = useBlockExplorer(
    environment.BLOCKCHAIN_EXPLORER_NAME,
    environment.BLOCKCHAIN_EXPLORER_URL,
  )
  const imageUrlLocal = useLocalFileURL(
    formData?.isPrivate || formData?.isAnimation
      ? formData?.preview
      : formData?.content,
  )
  const animationUrlLocal = useLocalFileURL(
    formData?.isAnimation && !formData.isPrivate ? formData.content : undefined,
  )

  const asset: NFTCardProps['asset'] = useMemo(
    () =>
      ({
        id: '',
        image: imageUrlLocal || undefined,
        animationUrl: animationUrlLocal,
        name: formData?.name || '',
        standard: multiple ? 'ERC1155' : 'ERC721',
      } as NFTCardProps['asset']),
    [imageUrlLocal, animationUrlLocal, formData?.name, multiple],
  )

  const creator = useMemo(
    () => ({
      address: data?.account?.address || '0x',
      image: data?.account?.image || undefined,
      name: data?.account?.name || undefined,
      verified: data?.account?.verification?.status === 'VALIDATED',
    }),
    [data?.account],
  )

  const categories = useMemo(
    () =>
      (traits['Category'] || []).map((x) => ({
        id: x,
        title: t(`categories.${x}`, null, { fallback: x }),
      })) || [],
    [t],
  )

  const onCreated = useCallback(
    async (assetId: string) => {
      toast({
        title: t('asset.form.notifications.created'),
        status: 'success',
      })
      await push(`/tokens/${assetId}`)
    },
    [push, t, toast],
  )

  useEffect(() => {
    void configPromise.then(setConfig)
    return () => setConfig(undefined)
  }, [configPromise])

  if (environment.RESTRICT_TO_VERIFIED_ACCOUNT && !creator.verified) {
    return (
      <Layout>
        <BackButton onClick={back} />
        <Heading as="h1" variant="title" color="brand.black" mt={6} mb={12}>
          {t('asset.typeSelector.title')}
        </Heading>
        <Stack align="center" spacing={6} mb={40}>
          <Center bgColor="brand.50" w={12} h={12} rounded="full">
            <Icon as={HiBadgeCheck} color="brand.500" w={6} h={6} />
          </Center>
          <Stack textAlign="center">
            <Heading variant="heading1">{t('asset.restricted.title')}</Heading>
            <Text pb={2} color="gray.500">
              <Trans
                ns="templates"
                i18nKey="asset.restricted.description"
                components={[
                  <Link
                    fontWeight="bold"
                    href={`mailto:${environment.REPORT_EMAIL}`}
                    key="report"
                  >
                    {environment.REPORT_EMAIL}
                  </Link>,
                ]}
              />
            </Text>
          </Stack>
          <Alert
            status="info"
            rounded="xl"
            borderWidth="1px"
            borderColor="blue.300"
          >
            <AlertIcon />
            <Text variant="subtitle2">{t('asset.restricted.info')}</Text>
          </Alert>
        </Stack>
      </Layout>
    )
  }

  return (
    <Layout>
      <BackButton onClick={back} />
      <Heading as="h1" variant="title" color="brand.black" mt={6}>
        {multiple
          ? t('asset.form.title.multiple')
          : t('asset.form.title.single')}
      </Heading>

      <Flex
        mt={12}
        w="full"
        gap={6}
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'center', md: 'flex-start' }}
      >
        <div>
          <Flex as={Text} color="brand.black" mb={3} variant="button1">
            {t('asset.form.preview')}
          </Flex>
          <TokenCard
            asset={asset}
            creator={creator}
            auction={undefined}
            sale={undefined}
            numberOfSales={0}
            hasMultiCurrency={false}
          />
        </div>
        <TokenFormCreate
          signer={signer}
          multiple={multiple}
          categories={categories}
          uploadUrl={environment.UPLOAD_URL}
          blockExplorer={blockExplorer}
          onCreated={onCreated}
          onInputChange={setFormData}
          login={{
            ...connectors,
            networkName: environment.NETWORK_NAME,
          }}
          activateUnlockableContent={config?.hasUnlockableContent || false}
          maxRoyalties={environment.MAX_ROYALTIES}
          activateLazyMint={config?.hasLazyMint || false}
        />
      </Flex>
    </Layout>
  )
}

export default CreatePage
